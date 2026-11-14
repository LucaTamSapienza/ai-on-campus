// Rotte della classe simulata, montate sotto /api dall'ingresso del Worker.
import { getAgentByName } from "agents";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { loadVersion } from "../esame/data";
import type { Classe } from "./classe";
import { loadClassRun, loadStudents } from "./data";

type App = { Bindings: Env };
export const classe = new Hono<App>();

function fail(c: Context<App>, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

for (const path of ["/courses/:id/students", "/questions/:id/class", "/class-runs/*"]) {
  classe.use(path, bodyLimit({ maxSize: 32 * 1024 }));
}

const MAX_STUDENTS = 12;

classe.get("/courses/:id/students", async (c) => {
  return c.json({ students: await loadStudents(c.env.DB, c.req.param("id")) });
});

// Profilo sintetico: le lezioni si indicano con il prefisso del titolo della fonte («L08»).
// Stesso nome nello stesso corso: il profilo si aggiorna, così la semina si può rifare.
const studentBody = z.object({
  name: z.string().trim().min(1).max(80),
  priorGrade: z.number().min(18).max(30),
  style: z.string().trim().min(1).max(300),
  lessons: z.array(z.string().trim().regex(/^[A-Za-z]?\d{1,3}$/)).max(40),
});

classe.post("/courses/:id/students", async (c) => {
  const parsed = studentBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(c, 400, "invalid_body", `Invalid request: ${issue.path.join(".") || "body"} ${issue.message}`);
  }
  const body = parsed.data;
  const db = c.env.DB;
  const courseId = c.req.param("id");
  if (!(await db.prepare("SELECT 1 FROM courses WHERE id = ?").bind(courseId).first())) return fail(c, 404, "not_found", "Course not found.");
  const existing = await db.prepare("SELECT id FROM students WHERE course_id = ? AND name = ?").bind(courseId, body.name).first<{ id: string }>();
  if (!existing) {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM students WHERE course_id = ?").bind(courseId).first<{ n: number }>();
    if ((n?.n ?? 0) >= MAX_STUDENTS) return fail(c, 409, "too_many_students", `The class already has ${MAX_STUDENTS} students, the maximum.`);
  }
  const sources = (
    await db.prepare("SELECT id, title FROM sources WHERE course_id = ? AND kind = 'document'").bind(courseId).all<{ id: string; title: string }>()
  ).results;
  const wanted = body.lessons.map((l) => l.toLowerCase());
  const picked = sources.filter((s) => wanted.some((w) => s.title.toLowerCase().startsWith(w)));
  const id = existing?.id ?? crypto.randomUUID();
  await db.batch([
    existing
      ? db.prepare("UPDATE students SET prior_grade = ?, style = ? WHERE id = ?").bind(body.priorGrade, body.style, id)
      : db.prepare("INSERT INTO students (id, course_id, name, prior_grade, style) VALUES (?, ?, ?, ?, ?)").bind(id, courseId, body.name, body.priorGrade, body.style),
    db.prepare("DELETE FROM student_sources WHERE student_id = ?").bind(id),
    ...picked.map((s) => db.prepare("INSERT INTO student_sources (student_id, source_id) VALUES (?, ?)").bind(id, s.id)),
  ]);
  return c.json({ id, lessons: picked.map((s) => s.title) }, existing ? 200 : 201);
});

// Fa sostenere la domanda alla classe, sulla versione corrente.
classe.post("/questions/:id/class", async (c) => {
  const db = c.env.DB;
  const q = await db
    .prepare("SELECT id, course_id AS courseId, current_version_id AS versionId FROM questions WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; courseId: string; versionId: string | null }>();
  if (!q) return fail(c, 404, "not_found", "Question not found.");
  const version = q.versionId ? await loadVersion(db, q.versionId) : null;
  if (!version || version.rubric.length === 0) return fail(c, 422, "rubric_required", "A grading rubric is required.");
  const students = await loadStudents(db, q.courseId);
  if (!students.length) return fail(c, 409, "no_students", "The simulated class is empty. Seed the synthetic students.");

  const runId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("INSERT INTO class_runs (id, question_id, question_version_id) VALUES (?, ?, ?)").bind(runId, q.id, version.id),
      ...students.map((s) => db.prepare("INSERT INTO class_answers (id, run_id, student_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), runId, s.id)),
    ]);
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
      const active = await db.prepare("SELECT id FROM class_runs WHERE question_id = ? AND status = 'running'").bind(q.id).first<{ id: string }>();
      return c.json({ error: { code: "run_active", message: "The class is already answering this question.", runId: active?.id ?? null } }, 409);
    }
    throw err;
  }
  try {
    const agent = await getAgentByName<Env, Classe>(c.env.Classe, runId);
    await agent.start(runId, students.map((s) => s.id));
  } catch (err) {
    console.error(err);
    await db.prepare("UPDATE class_runs SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?").bind("The class coordinator did not start.", runId).run();
    return fail(c, 503, "agent_unavailable", "The class coordinator did not start. Try again.");
  }
  return c.json({ runId }, 202);
});

// Ultima esecuzione della classe su una domanda, per riaprire la pagina dove si era.
classe.get("/questions/:id/class", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, status, question_version_id AS versionId FROM class_runs WHERE question_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
  )
    .bind(c.req.param("id"))
    .first<{ id: string; status: string; versionId: string }>();
  return c.json({ lastRun: row ?? null });
});

classe.get("/class-runs/:id", async (c) => {
  const run = await loadClassRun(c.env.DB, c.req.param("id"));
  if (!run) return fail(c, 404, "not_found", "Run not found.");
  return c.json({ run });
});
