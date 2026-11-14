// Piano di studio calcolato nel codice dal grafo, senza modello: perimetro (lezioni svolte),
// concetti già noti, ordine che rispetta prerequisito / parte_di / usa, divisione in sessioni.
//
// Il confine nel codice: il piano di studio e il Pianificatore leggono solo il grafo, le fonti e
// le proprie tabelle. Ogni query di questo modulo passa da studioQuery, che rifiuta qualunque
// tabella fuori da ALLOWED_TABLES: domande, griglie, attacchi e classe non si possono leggere.

const ALLOWED_TABLES = new Set([
  "courses",
  "sources",
  "passages",
  "topics",
  "concepts",
  "concept_passages",
  "relations",
  "lessons_done",
  "study_plans",
  "study_sessions",
]);

export function studioQuery(db: D1Database, sql: string, ...params: unknown[]) {
  for (const m of sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_]+)/gi)) {
    if (!ALLOWED_TABLES.has(m[1].toLowerCase())) throw new Error(`Piano di studio: la tabella ${m[1]} è fuori dal suo confine.`);
  }
  return db.prepare(sql).bind(...params);
}

export const MAX_SESSIONS = 12;
export const MAX_DAYS = 60;

export type Lesson = { id: string; title: string; index: number; done: boolean };
export type Evidence = { passageId: string; sourceId: string; sourceTitle: string; locator: string; ordinal: number; role: string; text: string };
export type StudyConcept = {
  id: string;
  name: string;
  kind: string;
  definition: string;
  topicName: string | null;
  evidence: Evidence[];
  // Lezione e passaggio in cui il concetto compare per la prima volta nel corso.
  introLesson: Lesson | null;
  introOrdinal: number;
};
export type CourseGraph = {
  lessons: Lesson[];
  concepts: Map<string, StudyConcept>;
  relations: { from: string; to: string; type: string }[];
  scope: "svolte" | "tutte";
  inScope: Set<string>;
};

export async function loadCourseGraph(db: D1Database, courseId: string): Promise<CourseGraph> {
  const [sources, done, concepts, evidence, relations] = await db.batch([
    studioQuery(db, "SELECT id, title FROM sources WHERE course_id = ? AND status = 'done' ORDER BY created_at, rowid", courseId),
    studioQuery(db, "SELECT source_id AS id FROM lessons_done WHERE course_id = ?", courseId),
    studioQuery(
      db,
      `SELECT c.id, c.name, c.kind, c.definition, t.name AS topicName FROM concepts c LEFT JOIN topics t ON t.id = c.topic_id WHERE c.course_id = ?`,
      courseId,
    ),
    // Solo passaggi con testo estratto: una slide vuota non vale come prova.
    studioQuery(
      db,
      `SELECT cp.concept_id AS conceptId, cp.role, p.id AS passageId, p.source_id AS sourceId, p.locator, p.ordinal, p.text, s.title AS sourceTitle
         FROM concept_passages cp JOIN passages p ON p.id = cp.passage_id JOIN sources s ON s.id = p.source_id
        WHERE p.course_id = ? AND p.thin = 0`,
      courseId,
    ),
    studioQuery(db, "SELECT from_concept_id AS 'from', to_concept_id AS 'to', type FROM relations WHERE course_id = ?", courseId),
  ]);

  const doneIds = new Set((done.results as { id: string }[]).map((r) => r.id));
  const lessons: Lesson[] = (sources.results as { id: string; title: string }[]).map((s, index) => ({ ...s, index, done: doneIds.has(s.id) }));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const byConcept = new Map<string, StudyConcept>();
  for (const c of concepts.results as { id: string; name: string; kind: string; definition: string; topicName: string | null }[]) {
    byConcept.set(c.id, { ...c, evidence: [], introLesson: null, introOrdinal: Number.MAX_SAFE_INTEGER });
  }
  for (const e of evidence.results as (Evidence & { conceptId: string })[]) {
    const c = byConcept.get(e.conceptId);
    const lesson = lessonById.get(e.sourceId);
    if (!c || !lesson) continue;
    c.evidence.push({ passageId: e.passageId, sourceId: e.sourceId, sourceTitle: e.sourceTitle, locator: e.locator, ordinal: e.ordinal, role: e.role, text: e.text });
    if (!c.introLesson || lesson.index < c.introLesson.index || (lesson.index === c.introLesson.index && e.ordinal < c.introOrdinal)) {
      c.introLesson = lesson;
      c.introOrdinal = e.ordinal;
    }
  }
  // Prove in ordine di corso, la definizione prima.
  for (const c of byConcept.values()) {
    c.evidence.sort(
      (a, b) =>
        (a.role === "definizione" ? 0 : 1) - (b.role === "definizione" ? 0 : 1) ||
        lessonById.get(a.sourceId)!.index - lessonById.get(b.sourceId)!.index ||
        a.ordinal - b.ordinal,
    );
  }

  // Perimetro: con lezioni svolte, i concetti che hanno almeno una prova in quelle lezioni.
  // Senza, tutti i concetti del corso (anche quelli senza prove, che restano segnati come tali).
  const scope = doneIds.size > 0 ? "svolte" : "tutte";
  const inScope = new Set(
    [...byConcept.values()].filter((c) => (scope === "tutte" ? true : c.evidence.some((e) => doneIds.has(e.sourceId)))).map((c) => c.id),
  );
  return { lessons, concepts: byConcept, relations: relations.results as CourseGraph["relations"], scope, inScope };
}

export type PlannedConcept = { id: string; after: string[] };
export type PlannedSession = { ordinal: number; day: number; concepts: PlannedConcept[] };
export type PlanStats = { inScope: number; known: number; toStudy: number; withoutEvidence: number; edges: number; cyclesBroken: number };

// Ordine di studio: «A prima di B» se A è prerequisito di B, se A è parte di B, se B usa A.
// Fra i concetti pronti si sceglie quello che il corso introduce prima. Un ciclo si spezza
// prendendo il concetto introdotto prima, e si conta.
export function buildPlan(
  graph: CourseGraph,
  input: { days: number; knownLessons: string[]; knownConcepts: string[] },
): { sessions: PlannedSession[]; stats: PlanStats } {
  const knownLessons = new Set(input.knownLessons);
  const known = new Set(
    [...graph.inScope].filter((id) => {
      const c = graph.concepts.get(id)!;
      return input.knownConcepts.includes(id) || (c.introLesson !== null && knownLessons.has(c.introLesson.id));
    }),
  );
  const todo = [...graph.inScope].filter((id) => !known.has(id));
  const todoSet = new Set(todo);

  const before = new Map<string, Set<string>>(todo.map((id) => [id, new Set()]));
  let edges = 0;
  for (const r of graph.relations) {
    const [first, then] = r.type === "prerequisito" || r.type === "parte_di" ? [r.from, r.to] : r.type === "usa" ? [r.to, r.from] : [null, null];
    if (!first || !then || first === then || !todoSet.has(first) || !todoSet.has(then)) continue;
    if (!before.get(then)!.has(first)) edges++;
    before.get(then)!.add(first);
  }

  const key = (id: string) => {
    const c = graph.concepts.get(id)!;
    return [c.introLesson?.index ?? Number.MAX_SAFE_INTEGER, c.introOrdinal, c.name.toLowerCase()] as const;
  };
  const cmp = (a: string, b: string) => {
    const [ka, kb] = [key(a), key(b)];
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  };

  const pending = new Set(todo);
  const placed = new Set<string>();
  const order: PlannedConcept[] = [];
  let cyclesBroken = 0;
  while (pending.size) {
    const ready = [...pending].filter((id) => [...before.get(id)!].every((p) => placed.has(p)));
    let next: string;
    if (ready.length) next = ready.sort(cmp)[0];
    else {
      next = [...pending].sort(cmp)[0];
      cyclesBroken++;
    }
    pending.delete(next);
    placed.add(next);
    order.push({ id: next, after: [...before.get(next)!].filter((p) => placed.has(p) && p !== next).sort(cmp) });
  }

  const count = Math.max(1, Math.min(input.days, MAX_SESSIONS, order.length));
  const sessions: PlannedSession[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.round((i * order.length) / count);
    const to = Math.round(((i + 1) * order.length) / count);
    sessions.push({ ordinal: i + 1, day: Math.floor((i * input.days) / count) + 1, concepts: order.slice(from, to) });
  }
  return {
    sessions: order.length ? sessions : [],
    stats: {
      inScope: graph.inScope.size,
      known: known.size,
      toStudy: order.length,
      withoutEvidence: order.filter((o) => graph.concepts.get(o.id)!.evidence.length === 0).length,
      edges,
      cyclesBroken,
    },
  };
}

export const shortLesson = (title: string) => title.match(/^(L\d+)[_\s-]/i)?.[1] ?? title;
