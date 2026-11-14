// Worker di PRISMA: /agents/* agli agenti, /api/* a Hono, il resto ai file statici del frontend.
import { getAgentByName, routeAgentRequest } from "agents";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { dailyBudget } from "./llm";
import { CONCEPT_KINDS, EVIDENCE_ROLES, slugify, upsertTopics, writeOntology, type Rejected } from "./ontology";
import { segment } from "./segment";

import { Cartografo } from "./cartografo";
export { Cartografo };

// fase 03: triplo attacco
import { Attacco } from "./esame/attacco";
import { esame } from "./esame/routes";
export { Attacco };
// fine fase 03

// blocco 2: classe simulata e ruolo studente
import { Classe } from "./classe/classe";
import { classe } from "./classe/routes";
import { studentAgentForbidden, studentGuard } from "./classe/role";
export { Classe };
import { lezioni } from "./lezioni/routes";
// fine blocco 2

// blocco 3: piano di studio dello studente
import { Pianificatore } from "./studio/pianificatore";
import { studio } from "./studio/routes";
export { Pianificatore };
// fine blocco 3

const VERSION = "0.2.0";
const MAX_SOURCE_CHARS = 300_000;
const MAX_SOURCES_PER_COURSE = 40;

type App = { Bindings: Env };
const app = new Hono<App>().basePath("/api");

function fail(c: Context<App>, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

async function readBody<T extends z.ZodType>(c: Context<App>, schema: T): Promise<z.infer<T> | Response> {
  const json = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(c, 400, "invalid_body", `Invalid request: ${issue.path.join(".") || "body"} ${issue.message}`);
  }
  return parsed.data;
}

// Sicurezza: intestazioni, CORS solo da localhost quando il Worker gira in locale.
app.use(secureHeaders());
app.use(
  cors({
    origin: (origin, c) => {
      return isLocal(new URL(c.req.url)) && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : null;
    },
    allowHeaders: ["content-type", "x-demo-code", /* blocco 2 */ "x-role"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", /* blocco 2 */ "PUT"],
  }),
);

// Codice demo: se il segreto DEMO_CODE è impostato lo chiedono tutte le rotte tranne /api/health,
// letture comprese (il grafo espone estratti delle slide). In locale, senza segreto, è tutto aperto.
app.use(async (c, next) => {
  if (c.req.method === "OPTIONS" || c.req.path === "/api/health" || !c.env.DEMO_CODE) return next();
  if (!timingSafeEqual(c.req.header("x-demo-code") ?? "", c.env.DEMO_CODE)) {
    return fail(c, 401, "demo_code", "The demo code is required.");
  }
  return next();
});

// blocco 2: con ruolo studente ogni scrittura ed esame, classe e proposte rispondono 403.
app.use(studentGuard);
// fine blocco 2

app.get("/health", (c) => c.json({ ok: true, version: VERSION }));

// Corsi

app.get("/courses", async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, name, description, created_at AS createdAt FROM courses ORDER BY created_at").all();
  return c.json({ courses: rows.results });
});

app.post("/courses", async (c) => {
  const body = await readBody(c, z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).default("") }));
  if (body instanceof Response) return body;
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO courses (id, name, description) VALUES (?, ?, ?)").bind(id, body.name, body.description).run();
  return c.json({ id, name: body.name, description: body.description }, 201);
});

async function courseExists(db: D1Database, id: string) {
  return !!(await db.prepare("SELECT 1 FROM courses WHERE id = ?").bind(id).first());
}

// Fonti

app.get("/courses/:id/sources", async (c) => {
  const id = c.req.param("id");
  if (!(await courseExists(c.env.DB, id))) return fail(c, 404, "not_found", "Course not found.");
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.kind, s.title, s.lesson_date AS lessonDate, s.status, s.error, s.created_at AS createdAt,
       (SELECT COUNT(*) FROM passages p WHERE p.source_id = s.id) AS passageCount,
       (SELECT COUNT(*) FROM passages p WHERE p.source_id = s.id AND p.thin = 1) AS thinCount,
       (SELECT COUNT(DISTINCT cp.concept_id) FROM concept_passages cp JOIN passages p ON p.id = cp.passage_id WHERE p.source_id = s.id) AS conceptCount
     FROM sources s WHERE s.course_id = ? ORDER BY s.created_at, s.rowid`,
  )
    .bind(id)
    .all();
  return c.json({ sources: rows.results });
});

const sourceBody = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["document", "transcript"]).default("document"),
  text: z.string().min(1).max(MAX_SOURCE_CHARS),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // false: solo fonte e passaggi, senza Cartografo (per l'ontologia importata).
  extract: z.boolean().default(true),
});

app.post("/courses/:id/sources", bodyLimit({ maxSize: 2 * 1024 * 1024 }), async (c) => {
  const courseId = c.req.param("id");
  const body = await readBody(c, sourceBody);
  if (body instanceof Response) return body;
  const db = c.env.DB;
  if (!(await courseExists(db, courseId))) return fail(c, 404, "not_found", "Course not found.");
  const count = await db.prepare("SELECT COUNT(*) AS n FROM sources WHERE course_id = ?").bind(courseId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_SOURCES_PER_COURSE) {
    return fail(c, 409, "too_many_sources", `The course already has ${MAX_SOURCES_PER_COURSE} sources, the maximum.`);
  }

  // Lo stesso contenuto nello stesso corso non crea doppioni.
  const hash = await sha256(body.text);
  const dup = await db.prepare("SELECT id FROM sources WHERE course_id = ? AND content_hash = ?").bind(courseId, hash).first<{ id: string }>();
  if (dup) return c.json({ sourceId: dup.id, duplicate: true }, 200);

  const redact = (c.env.REDACT_TERMS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const passages = segment(body.text, redact);
  if (passages.length === 0) return fail(c, 400, "empty_source", "The text contains no passages to read.");

  const sourceId = crypto.randomUUID();
  const stmts = [
    db
      .prepare("INSERT INTO sources (id, course_id, kind, title, lesson_date, status, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(sourceId, courseId, body.kind, body.title, body.lessonDate ?? null, body.extract ? "queued" : "done", hash),
    ...passages.map((p, i) =>
      db
        .prepare("INSERT INTO passages (id, source_id, course_id, ordinal, locator, text, thin) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), sourceId, courseId, i + 1, p.locator, p.text, p.thin ? 1 : 0),
    ),
  ];
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));

  if (body.extract) {
    const agent = await getAgentByName<Env, Cartografo>(c.env.Cartografo, courseId);
    await agent.enqueue(sourceId);
  }
  return c.json({ sourceId, passages: passages.length, thin: passages.filter((p) => p.thin).length }, 201);
});

// Ontologia preparata fuori dall'app: stessa validazione del Cartografo, idempotente.

const ontologyBody = z.object({
  topics: z.array(z.object({ name: z.string().trim().min(1).max(120), summary: z.string().max(400).default("") })).max(40),
  concepts: z
    .array(
      z.object({
        name: z.string(),
        topic: z.string().optional(),
        kind: z.enum(CONCEPT_KINDS).catch("concetto"),
        definition: z.string().default(""),
        evidence: z.array(z.object({ source: z.string(), slide: z.coerce.number().int(), role: z.enum(EVIDENCE_ROLES).catch("uso") })).max(40),
      }),
    )
    .max(1500),
  relations: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        // Il tipo si controlla per singola relazione in writeOntology: una sbagliata finisce nel report.
        type: z.string(),
        note: z.string().default(""),
        evidence: z.object({ source: z.string(), slide: z.coerce.number().int() }).nullable().optional(),
      }),
    )
    .max(5000),
});

app.post("/courses/:id/ontology", bodyLimit({ maxSize: 4 * 1024 * 1024 }), async (c) => {
  const courseId = c.req.param("id");
  const body = await readBody(c, ontologyBody);
  if (body instanceof Response) return body;
  const db = c.env.DB;
  if (!(await courseExists(db, courseId))) return fail(c, 404, "not_found", "Course not found.");

  const rows = (
    await db
      .prepare("SELECT p.id, p.locator, p.thin, s.title FROM passages p JOIN sources s ON s.id = p.source_id WHERE p.course_id = ?")
      .bind(courseId)
      .all<{ id: string; locator: string; thin: number; title: string }>()
  ).results;
  const passageKey = (source: string, slide: number) => `${source.trim().toLowerCase()}|slide ${slide}`;
  const byKey = new Map(rows.map((r) => [`${r.title.toLowerCase()}|${r.locator}`, r]));
  const allowed = new Set(rows.filter((r) => !r.thin).map((r) => r.id));
  // Ogni prova che non si risolve finisce nel report, con il motivo.
  const evidenceRejects: Rejected[] = [];
  const resolve = (owner: string, source: string, slide: number) => {
    const p = byKey.get(passageKey(source, slide));
    const reason = !p ? "source or slide does not exist" : p.thin ? "slide without extracted text" : null;
    if (reason && evidenceRejects.length < 300) evidenceRejects.push({ kind: "prova", name: `${owner}: ${source} slide ${slide}`, reason });
    return reason ? null : p!.id;
  };

  const topicIds = await upsertTopics(db, courseId, body.topics);
  const result = await writeOntology(
    db,
    courseId,
    {
      concepts: body.concepts.map((cpt) => ({
        ...cpt,
        evidence: cpt.evidence.map((e) => ({ passageId: resolve(cpt.name, e.source, e.slide) ?? "", role: e.role })),
      })),
      relations: body.relations.map((r) => ({
        ...r,
        passageId: r.evidence ? resolve(`${r.from} → ${r.to}`, r.evidence.source, r.evidence.slide) : null,
      })),
    },
    allowed,
    { overwrite: true, topicIds },
  );
  c.executionCtx.waitUntil(bumpRevision(c.env, courseId));
  return c.json({
    topics: topicIds.size,
    added: result.added.length,
    updated: result.updated,
    relations: result.relations,
    discarded: result.discarded,
    rejected: [...result.rejected, ...evidenceRejects],
  });
});

// Grafo e concetti

app.get("/courses/:id/graph", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  if (!(await courseExists(db, id))) return fail(c, 404, "not_found", "Course not found.");
  const [topics, concepts, relations] = await db.batch([
    db.prepare("SELECT id, name, summary, ordinal FROM topics WHERE course_id = ? ORDER BY ordinal").bind(id),
    db
      .prepare(
        `SELECT c.id, c.name, c.kind, c.topic_id AS topicId, c.created_at AS createdAt,
           (SELECT COUNT(*) FROM relations r WHERE r.from_concept_id = c.id OR r.to_concept_id = c.id) AS degree,
           (SELECT COUNT(*) FROM concept_passages cp WHERE cp.concept_id = c.id) AS passageCount
         FROM concepts c WHERE c.course_id = ? ORDER BY c.created_at, c.rowid`,
      )
      .bind(id),
    db.prepare("SELECT id, from_concept_id AS source, to_concept_id AS target, type FROM relations WHERE course_id = ?").bind(id),
  ]);
  return c.json({ topics: topics.results, concepts: concepts.results, relations: relations.results });
});

app.get("/concepts/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const concept = await db
    .prepare(
      `SELECT c.id, c.course_id AS courseId, c.name, c.definition, c.kind, t.id AS topicId, t.name AS topicName
       FROM concepts c LEFT JOIN topics t ON t.id = c.topic_id WHERE c.id = ?`,
    )
    .bind(id)
    .first();
  if (!concept) return fail(c, 404, "not_found", "Concept not found.");
  const [relations, passages] = await db.batch([
    db
      .prepare(
        `SELECT r.id, r.type, r.note, 'out' AS direction, o.id AS otherId, o.name AS otherName
           FROM relations r JOIN concepts o ON o.id = r.to_concept_id WHERE r.from_concept_id = ?1
         UNION ALL
         SELECT r.id, r.type, r.note, 'in' AS direction, o.id AS otherId, o.name AS otherName
           FROM relations r JOIN concepts o ON o.id = r.from_concept_id WHERE r.to_concept_id = ?1`,
      )
      .bind(id),
    db
      .prepare(
        `SELECT p.id, p.locator, p.text, cp.role, s.title AS sourceTitle
         FROM concept_passages cp JOIN passages p ON p.id = cp.passage_id JOIN sources s ON s.id = p.source_id
         WHERE cp.concept_id = ? ORDER BY CASE cp.role WHEN 'definizione' THEN 0 WHEN 'uso' THEN 1 ELSE 2 END, s.created_at, p.ordinal
         LIMIT 30`,
      )
      .bind(id),
  ]);
  return c.json({ concept, relations: relations.results, passages: passages.results });
});

app.patch("/concepts/:id", async (c) => {
  const id = c.req.param("id");
  const body = await readBody(
    c,
    z.object({ name: z.string().trim().min(1).max(120).optional(), definition: z.string().trim().max(800).optional() }),
  );
  if (body instanceof Response) return body;
  const db = c.env.DB;
  const current = await db.prepare("SELECT course_id, name, definition FROM concepts WHERE id = ?").bind(id).first<{
    course_id: string;
    name: string;
    definition: string;
  }>();
  if (!current) return fail(c, 404, "not_found", "Concept not found.");
  const name = body.name ?? current.name;
  const slug = slugify(name);
  if (!slug) return fail(c, 400, "invalid_body", "The name is not valid.");
  const clash = await db.prepare("SELECT 1 FROM concepts WHERE course_id = ? AND slug = ? AND id != ?").bind(current.course_id, slug, id).first();
  if (clash) return fail(c, 409, "duplicate", "A concept with this name already exists.");
  await db
    .prepare("UPDATE concepts SET name = ?, slug = ?, definition = ? WHERE id = ?")
    .bind(name, slug, body.definition ?? current.definition, id)
    .run();
  c.executionCtx.waitUntil(bumpRevision(c.env, current.course_id));
  return c.json({ id, name, definition: body.definition ?? current.definition });
});

app.delete("/concepts/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const row = await db.prepare("SELECT course_id FROM concepts WHERE id = ?").bind(id).first<{ course_id: string }>();
  if (!row) return fail(c, 404, "not_found", "Concept not found.");
  await db.batch([
    db.prepare("DELETE FROM relations WHERE from_concept_id = ?1 OR to_concept_id = ?1").bind(id),
    db.prepare("DELETE FROM concept_passages WHERE concept_id = ?").bind(id),
    db.prepare("DELETE FROM concepts WHERE id = ?").bind(id),
  ]);
  c.executionCtx.waitUntil(bumpRevision(c.env, row.course_id));
  return c.json({ ok: true });
});

// Spesa sui modelli

app.get("/usage", async (c) => {
  const [today, total] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(prompt_tokens), 0) AS promptTokens, COALESCE(SUM(completion_tokens), 0) AS completionTokens,
         COALESCE(SUM(cost_usd), 0) AS costUsd FROM model_calls WHERE created_at >= date('now')`,
    ),
    c.env.DB.prepare("SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS costUsd FROM model_calls"),
  ]);
  return c.json({ today: today.results[0], total: total.results[0], budgetUsd: dailyBudget(c.env) });
});

// fase 03: rotte dell'esame
app.route("/", esame);
// fine fase 03

// blocco 2: rotte della classe simulata e delle lezioni
app.route("/", classe);
app.route("/", lezioni);
// fine blocco 2

// blocco 3: rotte del piano di studio
app.route("/", studio);
// fine blocco 3

app.notFound((c) => fail(c, 404, "not_found", "Route not found."));
app.onError((err, c) => {
  console.error(err);
  return fail(c, 500, "internal", "Internal server error.");
});

async function bumpRevision(env: Env, courseId: string) {
  const agent = await getAgentByName<Env, Cartografo>(env.Cartografo, courseId);
  await agent.bumpRevision();
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const isLocal = (url: URL) => ["localhost", "127.0.0.1"].includes(url.hostname);

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) {
      const deny = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });
      // Origine: la stessa del Worker; in locale anche localhost (frontend su :3000).
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin && !(isLocal(url) && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
        return deny(403, "origin", "Origin not allowed.");
      }
      // Il browser non manda intestazioni sul WebSocket: il codice demo arriva come parametro.
      if (env.DEMO_CODE && !timingSafeEqual(url.searchParams.get("code") ?? "", env.DEMO_CODE)) {
        return deny(401, "demo_code", "The demo code is required.");
      }
      // blocco 2: lo studente vede solo il Cartografo; la classe solo per un'esecuzione che esiste.
      if (studentAgentForbidden(url)) return deny(403, "forbidden_role", "This part is not visible with the student role.");
      const classRun = url.pathname.match(/^\/agents\/classe\/([^/]+)$/);
      if (classRun) {
        const exists = await env.DB.prepare("SELECT 1 FROM class_runs WHERE id = ?").bind(decodeURIComponent(classRun[1])).first();
        if (!exists) return deny(404, "not_found", "Run not found.");
        return (await routeAgentRequest(request, env)) ?? deny(404, "not_found", "Agent not found.");
      }
      // fine blocco 2
      // blocco 3: il Pianificatore, solo per un piano che esiste.
      const plan = url.pathname.match(/^\/agents\/pianificatore\/([^/]+)$/);
      if (plan) {
        const exists = await env.DB.prepare("SELECT 1 FROM study_plans WHERE id = ?").bind(decodeURIComponent(plan[1])).first();
        if (!exists) return deny(404, "not_found", "Plan not found.");
        return (await routeAgentRequest(request, env)) ?? deny(404, "not_found", "Agent not found.");
      }
      // fine blocco 3
      // fase 03: il coordinatore del triplo attacco, solo per un'esecuzione che esiste.
      const run = url.pathname.match(/^\/agents\/attacco\/([^/]+)$/);
      if (run) {
        const exists = await env.DB.prepare("SELECT 1 FROM attack_runs WHERE id = ?").bind(decodeURIComponent(run[1])).first();
        if (!exists) return deny(404, "not_found", "Run not found.");
        return (await routeAgentRequest(request, env)) ?? deny(404, "not_found", "Agent not found.");
      }
      // fine fase 03
      // Solo il Cartografo, solo per un corso che esiste.
      const m = url.pathname.match(/^\/agents\/cartografo\/([^/]+)$/);
      if (!m || !(await courseExists(env.DB, decodeURIComponent(m[1])))) return deny(404, "not_found", "Agent not found.");
      return (await routeAgentRequest(request, env)) ?? deny(404, "not_found", "Agent not found.");
    }
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
