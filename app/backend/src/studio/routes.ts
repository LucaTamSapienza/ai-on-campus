// Rotte del piano di studio (blocco 3), montate sotto /api dall'ingresso del Worker. Le usa lo
// studente: sono le uniche scritture che il ruolo studente può fare (classe/role.ts).
//
// Lo studente manda solo numeri e identificatori (giorni, lezioni e concetti che conosce): nessun
// testo libero arriva al modello da qui. Ordine e sessioni li calcola plan.ts; il Pianificatore
// scrive solo le spiegazioni.
import { getAgentByName } from "agents";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { buildPlan, loadCourseGraph, MAX_DAYS, shortLesson, studioQuery } from "./plan";
import type { Pianificatore } from "./pianificatore";

type App = { Bindings: Env };
export const studio = new Hono<App>();

function fail(c: Context<App>, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

const courseExists = async (db: D1Database, id: string) => !!(await studioQuery(db, "SELECT 1 FROM courses WHERE id = ?", id).first());

// Piani in corso per corso, al massimo: protegge il tetto di spesa da chi preme tante volte.
const MAX_RUNNING = 3;

// Cosa può scegliere lo studente: le lezioni del perimetro e i concetti, con la lezione in cui compaiono.
studio.get("/courses/:id/studio", async (c) => {
  const id = c.req.param("id");
  if (!(await courseExists(c.env.DB, id))) return fail(c, 404, "not_found", "Course not found.");
  const graph = await loadCourseGraph(c.env.DB, id);
  const inScope = [...graph.inScope].map((cid) => graph.concepts.get(cid)!);
  const lessons = graph.lessons
    .map((l) => ({ id: l.id, title: l.title, short: shortLesson(l.title), done: l.done, concepts: inScope.filter((x) => x.introLesson?.id === l.id).length }))
    .filter((l) => l.concepts > 0);
  const concepts = inScope
    .map((x) => ({ id: x.id, name: x.name, lessonId: x.introLesson?.id ?? null, evidence: x.evidence.length }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ scope: graph.scope, lessons, concepts, maxDays: MAX_DAYS });
});

const planBody = z.object({
  days: z.number().int().min(1).max(MAX_DAYS),
  knownLessons: z.array(z.string().uuid()).max(60).default([]),
  knownConcepts: z.array(z.string().uuid()).max(400).default([]),
});

studio.post("/courses/:id/study-plans", bodyLimit({ maxSize: 32 * 1024 }), async (c) => {
  const parsed = planBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(c, 400, "invalid_body", `Invalid request: ${issue.path.join(".") || "body"} ${issue.message}`);
  }
  const body = parsed.data;
  const db = c.env.DB;
  const courseId = c.req.param("id");
  if (!(await courseExists(db, courseId))) return fail(c, 404, "not_found", "Course not found.");
  const running = await studioQuery(
    db,
    "SELECT COUNT(*) AS n FROM study_plans WHERE course_id = ? AND status = 'running' AND created_at >= datetime('now', '-10 minutes')",
    courseId,
  ).first<{ n: number }>();
  if ((running?.n ?? 0) >= MAX_RUNNING) return fail(c, 429, "too_many_plans", "Too many plans are already being prepared. Try again in a minute.");

  const graph = await loadCourseGraph(db, courseId);
  // Solo identificatori di questo corso: il resto si ignora.
  const knownLessons = body.knownLessons.filter((id) => graph.lessons.some((l) => l.id === id));
  const knownConcepts = body.knownConcepts.filter((id) => graph.inScope.has(id));
  const { sessions, stats } = buildPlan(graph, { days: body.days, knownLessons, knownConcepts });
  if (!sessions.length) return fail(c, 422, "nothing_to_study", "With what you already know, nothing is left to study in the course scope.");

  const planId = crypto.randomUUID();
  const sessionIds = sessions.map(() => crypto.randomUUID());
  await db.batch([
    studioQuery(
      db,
      "INSERT INTO study_plans (id, course_id, days, scope, known_lessons, known_concepts, stats) VALUES (?, ?, ?, ?, ?, ?, ?)",
      planId,
      courseId,
      body.days,
      graph.scope,
      JSON.stringify(knownLessons),
      JSON.stringify(knownConcepts),
      JSON.stringify(stats),
    ),
    ...sessions.map((s, i) =>
      studioQuery(db, "INSERT INTO study_sessions (id, plan_id, ordinal, day, concepts) VALUES (?, ?, ?, ?, ?)", sessionIds[i], planId, s.ordinal, s.day, JSON.stringify(s.concepts)),
    ),
  ]);
  try {
    const agent = await getAgentByName<Env, Pianificatore>(c.env.Pianificatore, planId);
    await agent.start(planId, sessionIds);
  } catch (err) {
    console.error(err);
    await studioQuery(db, "UPDATE study_plans SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?", "Il Pianificatore non è partito", planId).run();
    return fail(c, 503, "agent_unavailable", "The Planner did not start. Try again.");
  }
  return c.json({ planId }, 202);
});

// Il piano con le sessioni: concetti in ordine (con il perché dell'ordine dal grafo), spiegazione
// del Pianificatore e passaggi da guardare, risolti dal backend.
studio.get("/study-plans/:id", async (c) => {
  const db = c.env.DB;
  const plan = await studioQuery(
    db,
    "SELECT id, course_id AS courseId, days, scope, known_lessons AS knownLessons, known_concepts AS knownConcepts, stats, status, error, created_at AS createdAt FROM study_plans WHERE id = ?",
    c.req.param("id"),
  ).first<Record<string, unknown> & { courseId: string; knownLessons: string; knownConcepts: string; stats: string }>();
  if (!plan) return fail(c, 404, "not_found", "Plan not found.");
  const rows = (
    await studioQuery(db, "SELECT id, ordinal, day, concepts, status, why, look, error FROM study_sessions WHERE plan_id = ? ORDER BY ordinal", plan.id).all<{
      id: string;
      ordinal: number;
      day: number;
      concepts: string;
      status: string;
      why: string | null;
      look: string;
      error: string | null;
    }>()
  ).results;
  const graph = await loadCourseGraph(db, plan.courseId);
  const passages = new Map<string, { id: string; locator: string; sourceTitle: string; text: string }>();
  for (const cpt of graph.concepts.values()) for (const e of cpt.evidence) passages.set(e.passageId, { id: e.passageId, locator: e.locator, sourceTitle: e.sourceTitle, text: e.text });

  const sessions = rows.map((r) => ({
    id: r.id,
    ordinal: r.ordinal,
    day: r.day,
    status: r.status,
    error: r.error,
    why: r.why,
    concepts: (JSON.parse(r.concepts) as { id: string; after: string[] }[]).map((p) => {
      const cpt = graph.concepts.get(p.id);
      return {
        id: p.id,
        name: cpt?.name ?? "Removed concept",
        topicName: cpt?.topicName ?? null,
        lesson: cpt?.introLesson ? shortLesson(cpt.introLesson.title) : null,
        evidence: cpt?.evidence.length ?? 0,
        after: p.after.map((id) => graph.concepts.get(id)?.name).filter(Boolean),
      };
    }),
    look: (JSON.parse(r.look) as { passageId: string; note: string }[])
      .map((l) => ({ note: l.note, passage: passages.get(l.passageId) ?? null }))
      .filter((l) => l.passage),
  }));
  const { courseId: _courseId, ...rest } = plan;
  return c.json({
    plan: {
      ...rest,
      knownLessons: JSON.parse(plan.knownLessons),
      knownConcepts: JSON.parse(plan.knownConcepts),
      stats: JSON.parse(plan.stats),
      sessions,
    },
  });
});
