// Letture della classe simulata da D1, condivise fra rotte e coordinatore, e riepilogo calcolato
// dal backend: distribuzione dei voti e concetti mancanti che spiegano i punti persi.
import type { PerCriterion } from "../esame/agents";
import { loadVersion, type VersionRow } from "../esame/data";
import type { TouchedConcept } from "../esame/retrieval";

export type Student = {
  id: string;
  name: string;
  priorGrade: number;
  style: string;
  lessons: { id: string; title: string }[];
};

export type ClassAnswer = {
  id: string;
  studentId: string;
  status: "pending" | "running" | "done" | "error";
  answer: string | null;
  passageIds: string[];
  missing: { id: string; name: string }[];
  total: number | null;
  max: number | null;
  perCriterion: PerCriterion[];
  error: string | null;
};

export type ClassPassage = { id: string; rank: number; locator: string; sourceId: string; sourceTitle: string; text: string };

export type ConceptGap = {
  id: string;
  name: string;
  missingCount: number;
  // Media del voto in percentuale fra chi non ha seguito il concetto e chi sì (null se il gruppo è vuoto).
  avgMissing: number | null;
  avgFollowed: number | null;
};

export type ClassSummary = {
  graded: number;
  max: number;
  mean: number | null;
  // Fasce di voto in percentuale del massimo: 0-40, 40-60, 60-80, 80-100.
  bands: { label: string; count: number }[];
  criteria: { id: string; criterion: string; max: number; avg: number }[];
  gaps: ConceptGap[];
  // Le lezioni da cui vengono i passaggi recuperati: voto medio di chi le ha seguite e di chi no.
  lessons: { id: string; title: string; missingCount: number; avgMissing: number | null; avgFollowed: number | null }[];
};

export type ClassRunDetail = {
  id: string;
  questionId: string;
  status: "running" | "done" | "error";
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  version: VersionRow;
  retrieval: { terms: string[]; concepts: TouchedConcept[] } | null;
  passages: ClassPassage[];
  students: Student[];
  answers: ClassAnswer[];
  summary: ClassSummary | null;
};

const parse = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export async function loadStudents(db: D1Database, courseId: string): Promise<Student[]> {
  const [students, lessons] = await db.batch([
    db.prepare("SELECT id, name, prior_grade AS priorGrade, style FROM students WHERE course_id = ? ORDER BY name").bind(courseId),
    db
      .prepare(
        `SELECT ss.student_id AS studentId, s.id, s.title FROM student_sources ss JOIN sources s ON s.id = ss.source_id
          WHERE s.course_id = ? ORDER BY s.title`,
      )
      .bind(courseId),
  ]);
  const byStudent = new Map<string, { id: string; title: string }[]>();
  for (const l of lessons.results as { studentId: string; id: string; title: string }[]) {
    const list = byStudent.get(l.studentId) ?? [];
    list.push({ id: l.id, title: l.title });
    byStudent.set(l.studentId, list);
  }
  return (students.results as Omit<Student, "lessons">[]).map((s) => ({ ...s, lessons: byStudent.get(s.id) ?? [] }));
}

export async function loadClassRun(db: D1Database, runId: string): Promise<ClassRunDetail | null> {
  const run = await db
    .prepare(
      `SELECT r.id, r.question_id AS questionId, r.question_version_id AS versionId, r.status, r.error, r.retrieval,
              r.created_at AS createdAt, r.finished_at AS finishedAt, q.course_id AS courseId
         FROM class_runs r JOIN questions q ON q.id = r.question_id WHERE r.id = ?`,
    )
    .bind(runId)
    .first<{
      id: string;
      questionId: string;
      versionId: string;
      status: ClassRunDetail["status"];
      error: string | null;
      retrieval: string | null;
      createdAt: string;
      finishedAt: string | null;
      courseId: string;
    }>();
  if (!run) return null;
  const version = await loadVersion(db, run.versionId);
  if (!version) return null;
  const [passages, answers] = await db.batch([
    db
      .prepare(
        `SELECT p.id, rp.rank, p.locator, s.id AS sourceId, s.title AS sourceTitle, p.text
           FROM class_run_passages rp JOIN passages p ON p.id = rp.passage_id JOIN sources s ON s.id = p.source_id
          WHERE rp.run_id = ? ORDER BY rp.rank`,
      )
      .bind(runId),
    db
      .prepare(
        `SELECT id, student_id AS studentId, status, answer, passage_ids AS passageIds, missing, total, max,
                per_criterion AS perCriterion, error FROM class_answers WHERE run_id = ?`,
      )
      .bind(runId),
  ]);
  const students = await loadStudents(db, run.courseId);
  const rows = (answers.results as (Omit<ClassAnswer, "passageIds" | "missing" | "perCriterion"> & {
    passageIds: string | null;
    missing: string | null;
    perCriterion: string | null;
  })[]).map((a) => ({
    ...a,
    passageIds: parse<string[]>(a.passageIds, []),
    missing: parse<{ id: string; name: string }[]>(a.missing, []),
    perCriterion: parse<PerCriterion[]>(a.perCriterion, []),
  }));
  const order = new Map(students.map((s, i) => [s.id, i]));
  rows.sort((a, b) => (order.get(a.studentId) ?? 0) - (order.get(b.studentId) ?? 0));
  const retrieval = parse<{ terms: string[]; concepts: TouchedConcept[] } | null>(run.retrieval, null);
  return {
    id: run.id,
    questionId: run.questionId,
    status: run.status,
    error: run.error,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
    version,
    retrieval,
    passages: passages.results as ClassPassage[],
    students: students.filter((s) => order.has(s.id) && rows.some((a) => a.studentId === s.id)),
    answers: rows,
    summary: summarize(rows, version, passages.results as ClassPassage[], students),
  };
}

// Riepilogo calcolato nel codice sui voti del Correttore, nessun modello.
export function summarize(answers: ClassAnswer[], version: VersionRow, passages: ClassPassage[], students: Student[]): ClassSummary | null {
  const graded = answers.filter((a) => a.status === "done" && a.total !== null && a.max);
  if (!graded.length) return null;
  const max = version.maxPoints;
  const pct = (a: ClassAnswer) => (a.total! / (a.max || max)) * 100;
  const bands = [
    { label: "meno del 40%", lo: 0, hi: 40 },
    { label: "40-60%", lo: 40, hi: 60 },
    { label: "60-80%", lo: 60, hi: 80 },
    { label: "80% e oltre", lo: 80, hi: 101 },
  ].map((b) => ({ label: b.label, count: graded.filter((a) => pct(a) >= b.lo && pct(a) < b.hi).length }));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const criteria = version.rubric.map((r) => ({
    id: r.id,
    criterion: r.criterion,
    max: r.points,
    avg: avg(graded.map((a) => a.perCriterion.find((c) => c.id === r.id)?.awarded ?? 0)) ?? 0,
  }));
  const split = (isMissing: (a: ClassAnswer) => boolean) => {
    const missing = graded.filter(isMissing);
    const followed = graded.filter((a) => !isMissing(a));
    return { missingCount: missing.length, avgMissing: avg(missing.map(pct)), avgFollowed: avg(followed.map(pct)) };
  };
  // Prima ciò che separa di più i voti di chi l'ha seguito da chi no.
  const byGap = <T extends { missingCount: number; avgMissing: number | null; avgFollowed: number | null }>(a: T, b: T) =>
    (b.avgFollowed ?? 0) - (b.avgMissing ?? 0) - ((a.avgFollowed ?? 0) - (a.avgMissing ?? 0)) || b.missingCount - a.missingCount;
  const concepts = new Map<string, string>();
  for (const a of graded) for (const m of a.missing) concepts.set(m.id, m.name);
  const gaps: ConceptGap[] = [...concepts]
    .map(([id, name]) => ({ id, name, ...split((a) => a.missing.some((m) => m.id === id)) }))
    .sort(byGap);
  const lessonsOf = new Map(students.map((s) => [s.id, new Set(s.lessons.map((l) => l.id))]));
  const sources = new Map(passages.map((p) => [p.sourceId, p.sourceTitle]));
  const lessons = [...sources]
    .map(([id, title]) => ({ id, title, ...split((a) => !lessonsOf.get(a.studentId)?.has(id)) }))
    .filter((l) => l.missingCount > 0)
    .sort(byGap);
  return {
    graded: graded.length,
    max,
    mean: avg(graded.map((a) => a.total!)),
    bands,
    criteria,
    gaps,
    lessons,
  };
}
