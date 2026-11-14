// Rotte dell'esame e del triplo attacco, montate sotto /api dall'ingresso del Worker.
import { getAgentByName } from "agents";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { Attacco } from "./attacco";
import { AGENTS, loadRun, loadVersion, type RunDetail, type Verdict } from "./data";

type App = { Bindings: Env };
export const esame = new Hono<App>();

const MAX_QUESTION_CHARS = 4_000;
const MAX_CRITERIA = 12;

function fail(c: Context<App>, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

async function readBody<T extends z.ZodType>(c: Context<App>, schema: T): Promise<z.infer<T> | Response> {
  const json = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(c, 400, "invalid_body", `Richiesta non valida: ${issue.path.join(".") || "corpo"} ${issue.message}`);
  }
  return parsed.data;
}

// Il codice demo lo chiede il middleware dell'ingresso su tutte le rotte di /api, letture comprese;
// sulle connessioni al coordinatore lo controlla l'ingresso del Worker (?code=).
// Solo sui percorsi dell'esame: un middleware su "*" finirebbe su tutte le rotte di /api.
for (const path of ["/courses/:id/exams", "/exams/*", "/questions/*", "/runs/*"]) {
  esame.use(path, bodyLimit({ maxSize: 64 * 1024 }));
}

const isUnique = (err: unknown) => err instanceof Error && /UNIQUE constraint failed/i.test(err.message);

// Esami

esame.get("/courses/:id/exams", async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, title, created_at AS createdAt FROM exams WHERE course_id = ? ORDER BY created_at")
    .bind(c.req.param("id"))
    .all();
  return c.json({ exams: rows.results });
});

esame.post("/courses/:id/exams", async (c) => {
  const body = await readBody(c, z.object({ title: z.string().trim().min(1).max(120) }));
  if (body instanceof Response) return body;
  const courseId = c.req.param("id");
  if (!(await c.env.DB.prepare("SELECT 1 FROM courses WHERE id = ?").bind(courseId).first())) return fail(c, 404, "not_found", "Corso non trovato.");
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO exams (id, course_id, title) VALUES (?, ?, ?)").bind(id, courseId, body.title).run();
  return c.json({ id, title: body.title }, 201);
});

esame.get("/exams/:id", async (c) => {
  const db = c.env.DB;
  const exam = await db.prepare("SELECT id, course_id AS courseId, title, created_at AS createdAt FROM exams WHERE id = ?").bind(c.req.param("id")).first();
  if (!exam) return fail(c, 404, "not_found", "Esame non trovato.");
  const rows = (
    await db
      .prepare(
        `SELECT q.id, q.ordinal, v.id AS versionId, v.version, v.text, v.max_points AS maxPoints,
                (SELECT r.id FROM attack_runs r WHERE r.question_id = q.id ORDER BY r.created_at DESC, r.rowid DESC LIMIT 1) AS lastRunId
           FROM questions q LEFT JOIN question_versions v ON v.id = q.current_version_id
          WHERE q.exam_id = ? ORDER BY q.ordinal`,
      )
      .bind(exam.id)
      .all<{ id: string; ordinal: number; versionId: string; version: number; text: string; maxPoints: number; lastRunId: string | null }>()
  ).results;
  const questions = await Promise.all(
    rows.map(async (q) => {
      const last = q.lastRunId
        ? await db
            .prepare(
              `SELECT r.id, r.status, r.question_version_id AS versionId, rv.verdicts FROM attack_runs r
                 LEFT JOIN reviews rv ON rv.run_id = r.id WHERE r.id = ?`,
            )
            .bind(q.lastRunId)
            .first<{ id: string; status: string; versionId: string; verdicts: string | null }>()
        : null;
      return {
        id: q.id,
        ordinal: q.ordinal,
        version: { id: q.versionId, version: q.version, text: q.text, maxPoints: q.maxPoints },
        lastRun: last
          ? {
              id: last.id,
              status: last.status,
              onCurrentVersion: last.versionId === q.versionId,
              verdicts: last.verdicts ? (JSON.parse(last.verdicts) as Verdict[]).map((v) => ({ kind: v.kind, title: v.title })) : [],
            }
          : null,
      };
    }),
  );
  return c.json({ exam, questions });
});

// Domande

const rubricItem = z.object({
  criterion: z.string().trim().min(1).max(300),
  points: z.number().positive().max(100),
  expected: z.string().trim().max(600).optional(),
});

esame.post("/exams/:id/questions", async (c) => {
  const raw = (await c.req.json().catch(() => undefined)) as { rubric?: unknown } | undefined;
  if (!raw || !Array.isArray(raw.rubric) || raw.rubric.length === 0) {
    return fail(c, 422, "rubric_required", "Serve la griglia di correzione.");
  }
  const parsed = z
    .object({ text: z.string().trim().min(10).max(MAX_QUESTION_CHARS), rubric: z.array(rubricItem).min(1).max(MAX_CRITERIA) })
    .safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(c, 400, "invalid_body", `Richiesta non valida: ${issue.path.join(".") || "corpo"} ${issue.message}`);
  }
  const body = parsed.data;
  const db = c.env.DB;
  const exam = await db.prepare("SELECT id, course_id FROM exams WHERE id = ?").bind(c.req.param("id")).first<{ id: string; course_id: string }>();
  if (!exam) return fail(c, 404, "not_found", "Esame non trovato.");

  const rubric = body.rubric.map((r, i) => ({ id: `c${i + 1}`, criterion: r.criterion, points: r.points, ...(r.expected ? { expected: r.expected } : {}) }));
  const maxPoints = rubric.reduce((s, r) => s + r.points, 0);
  const questionId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO questions (id, exam_id, course_id, ordinal) VALUES (?, ?, ?, (SELECT COALESCE(MAX(ordinal), 0) + 1 FROM questions WHERE exam_id = ?))",
      )
      .bind(questionId, exam.id, exam.course_id, exam.id),
    db
      .prepare("INSERT INTO question_versions (id, question_id, version, text, rubric, max_points, origin) VALUES (?, ?, 1, ?, ?, ?, 'docente')")
      .bind(versionId, questionId, body.text, JSON.stringify(rubric), maxPoints),
    db.prepare("UPDATE questions SET current_version_id = ? WHERE id = ?").bind(versionId, questionId),
  ]);
  return c.json({ id: questionId, versionId }, 201);
});

esame.get("/questions/:id", async (c) => {
  const db = c.env.DB;
  const q = await db
    .prepare("SELECT id, exam_id AS examId, course_id AS courseId, ordinal, current_version_id AS currentVersionId FROM questions WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; examId: string; courseId: string; ordinal: number; currentVersionId: string | null }>();
  if (!q) return fail(c, 404, "not_found", "Domanda non trovata.");
  const version = q.currentVersionId ? await loadVersion(db, q.currentVersionId) : null;
  const last = await db
    .prepare("SELECT id, status, question_version_id AS versionId FROM attack_runs WHERE question_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
    .bind(q.id)
    .first<{ id: string; status: string; versionId: string }>();
  const lastDecision = await db
    .prepare(
      "SELECT review_id AS reviewId, action, to_version_id AS toVersionId FROM decisions WHERE question_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .bind(q.id)
    .first();
  return c.json({ question: q, version, lastRun: last, lastDecision });
});

// Avvia un'esecuzione sulla versione corrente: stato scritto in D1, poi il coordinatore la prende
// dalla sua coda durevole, poi 202. Una sola esecuzione attiva per domanda.
esame.post("/questions/:id/attack", async (c) => {
  const db = c.env.DB;
  const q = await db
    .prepare("SELECT id, current_version_id AS versionId FROM questions WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; versionId: string | null }>();
  if (!q) return fail(c, 404, "not_found", "Domanda non trovata.");
  const version = q.versionId ? await loadVersion(db, q.versionId) : null;
  if (!version || version.rubric.length === 0) return fail(c, 422, "rubric_required", "Serve la griglia di correzione.");

  const runId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("INSERT INTO attack_runs (id, question_id, question_version_id, status) VALUES (?, ?, ?, 'running')").bind(runId, q.id, version.id),
      ...AGENTS.map((agent) => db.prepare("INSERT INTO attacks (id, run_id, agent) VALUES (?, ?, ?)").bind(crypto.randomUUID(), runId, agent)),
    ]);
  } catch (err) {
    if (isUnique(err)) {
      const active = await db.prepare("SELECT id FROM attack_runs WHERE question_id = ? AND status = 'running'").bind(q.id).first<{ id: string }>();
      return c.json({ error: { code: "run_active", message: "C'è già un attacco in corso su questa domanda.", runId: active?.id ?? null } }, 409);
    }
    throw err;
  }
  try {
    const agent = await getAgentByName<Env, Attacco>(c.env.Attacco, runId);
    await agent.start(runId);
  } catch (err) {
    console.error(err);
    await db
      .prepare("UPDATE attack_runs SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind("Il coordinatore non è partito", runId)
      .run();
    return fail(c, 503, "agent_unavailable", "Il coordinatore degli agenti non è partito. Riprova.");
  }
  return c.json({ runId }, 202);
});

esame.get("/runs/:id", async (c) => {
  const run = await loadRun(c.env.DB, c.req.param("id"));
  if (!run) return fail(c, 404, "not_found", "Esecuzione non trovata.");
  return c.json({ run });
});

// Decisione del docente. Solo questa rotta crea versioni. Versione, decisione e puntatore in un
// solo batch, condizionato alla versione che il client si aspetta: se nel frattempo è cambiata, 409.
const decisionBody = z.object({
  reviewId: z.string().min(1).max(64),
  expectedVersionId: z.string().min(1).max(64),
  action: z.enum(["approvata", "modificata", "tenuta"]),
  text: z.string().trim().min(10).max(MAX_QUESTION_CHARS).optional(),
});

esame.post("/questions/:id/decision", async (c) => {
  const body = await readBody(c, decisionBody);
  if (body instanceof Response) return body;
  const db = c.env.DB;
  const questionId = c.req.param("id");
  const q = await db.prepare("SELECT id, current_version_id AS current FROM questions WHERE id = ?").bind(questionId).first<{ id: string; current: string | null }>();
  if (!q) return fail(c, 404, "not_found", "Domanda non trovata.");
  if (q.current !== body.expectedVersionId) {
    return fail(c, 409, "version_changed", "La domanda è cambiata nel frattempo. Ricarica la pagina.");
  }
  const review = await db
    .prepare(
      `SELECT rv.id, rv.proposed_text AS proposedText FROM reviews rv JOIN attack_runs r ON r.id = rv.run_id
        WHERE rv.id = ? AND r.question_id = ? AND r.question_version_id = ?`,
    )
    .bind(body.reviewId, questionId, body.expectedVersionId)
    .first<{ id: string; proposedText: string | null }>();
  if (!review) return fail(c, 404, "not_found", "Scheda non trovata per questa versione della domanda.");

  const decisionId = crypto.randomUUID();
  const current = "(SELECT current_version_id FROM questions WHERE id = ?)";
  if (body.action === "tenuta") {
    const res = await db
      .prepare(
        `INSERT INTO decisions (id, question_id, review_id, from_version_id, to_version_id, action)
         SELECT ?, ?, ?, ?, NULL, 'tenuta' WHERE ${current} = ?`,
      )
      .bind(decisionId, questionId, review.id, body.expectedVersionId, questionId, body.expectedVersionId)
      .run();
    if (!res.meta.changes) return fail(c, 409, "version_changed", "La domanda è cambiata nel frattempo. Ricarica la pagina.");
    return c.json({ versionId: body.expectedVersionId, decisionId });
  }

  const text = body.action === "approvata" ? review.proposedText : body.text;
  if (!text) {
    return fail(c, 400, "invalid_body", body.action === "approvata" ? "Il Revisore non ha proposto un testo da approvare." : "Serve il testo modificato.");
  }
  const versionId = crypto.randomUUID();
  const origin = body.action === "approvata" ? "proposta_approvata" : "proposta_modificata";
  const results = await db.batch([
    // La griglia resta quella del docente: si copia dalla versione di partenza.
    db
      .prepare(
        `INSERT INTO question_versions (id, question_id, version, text, rubric, max_points, origin)
         SELECT ?, v.question_id, (SELECT MAX(version) + 1 FROM question_versions WHERE question_id = v.question_id), ?, v.rubric, v.max_points, ?
           FROM question_versions v WHERE v.id = ? AND ${current} = v.id`,
      )
      .bind(versionId, text, origin, body.expectedVersionId, questionId),
    db
      .prepare(
        `INSERT INTO decisions (id, question_id, review_id, from_version_id, to_version_id, action)
         SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM question_versions WHERE id = ?)`,
      )
      .bind(decisionId, questionId, review.id, body.expectedVersionId, versionId, body.action, versionId),
    db
      .prepare("UPDATE questions SET current_version_id = ? WHERE id = ? AND current_version_id = ? AND EXISTS (SELECT 1 FROM question_versions WHERE id = ?)")
      .bind(versionId, questionId, body.expectedVersionId, versionId),
  ]);
  if (!results[0].meta.changes) return fail(c, 409, "version_changed", "La domanda è cambiata nel frattempo. Ricarica la pagina.");
  return c.json({ versionId, decisionId });
});

// Storia delle versioni con l'esito dell'ultima esecuzione chiusa di ciascuna: il prima e dopo.
esame.get("/questions/:id/versions", async (c) => {
  const db = c.env.DB;
  const questionId = c.req.param("id");
  const versions = (
    await db
      .prepare("SELECT id FROM question_versions WHERE question_id = ? ORDER BY version")
      .bind(questionId)
      .all<{ id: string }>()
  ).results;
  if (!versions.length) return fail(c, 404, "not_found", "Domanda non trovata.");
  const decisions = (
    await db
      .prepare("SELECT to_version_id AS toVersionId, action, created_at AS createdAt FROM decisions WHERE question_id = ? ORDER BY created_at")
      .bind(questionId)
      .all<{ toVersionId: string | null; action: string; createdAt: string }>()
  ).results;
  const out = await Promise.all(
    versions.map(async ({ id }) => {
      const version = (await loadVersion(db, id))!;
      const last = await db
        .prepare(
          `SELECT id FROM attack_runs WHERE question_version_id = ? AND status != 'running' ORDER BY created_at DESC, rowid DESC LIMIT 1`,
        )
        .bind(id)
        .first<{ id: string }>();
      const run = last ? await loadRun(db, last.id) : null;
      return { version, decision: decisions.find((d) => d.toVersionId === id) ?? null, outcome: run ? summarize(run) : null };
    }),
  );
  return c.json({ versions: out });
});

function summarize(run: RunDetail) {
  return {
    runId: run.id,
    status: run.status,
    agents: run.attacks.map((a) => ({
      agent: a.agent,
      status: a.status,
      found: a.agent === "cavillatore" ? !!(a.finding as { found?: boolean } | null)?.found : undefined,
      grades: a.grades.map((g) => ({ readingIndex: g.readingIndex, total: g.total, max: g.max })),
    })),
    verdicts: (run.review?.verdicts ?? []).map((v) => ({ kind: v.kind, title: v.title })),
  };
}
