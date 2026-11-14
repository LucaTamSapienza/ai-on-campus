// Unico modulo che parla con l'API. File comune dell'orchestratore.
// In sviluppo l'indirizzo del Worker arriva da NEXT_PUBLIC_API_BASE (.env.development, :8787);
// nell'export statico servito dal Worker la variabile non c'è e l'API è la stessa origine.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

// Host per il WebSocket degli agenti (useAgent): undefined = stessa origine.
export const AGENT_HOST = API_BASE ? new URL(API_BASE).host : undefined;

// Tipi

export type Course = { id: string; name: string; description: string; createdAt: string };

export type SourceStatus = "queued" | "processing" | "done" | "error";
export type Source = {
  id: string;
  kind: "document" | "transcript";
  title: string;
  lessonDate: string | null;
  status: SourceStatus;
  error: string | null;
  createdAt: string;
  passageCount: number;
  thinCount: number;
  conceptCount: number;
};

export type ConceptKind = "concetto" | "metodo" | "risultato" | "esempio";
export type RelationType = "prerequisito" | "parte_di" | "generalizza" | "usa" | "contrasta";

export type Topic = { id: string; name: string; summary: string; ordinal: number };
export type GraphConcept = {
  id: string;
  name: string;
  kind: ConceptKind;
  topicId: string | null;
  createdAt: string;
  degree: number;
  passageCount: number;
};
export type GraphRelation = { id: string; source: string; target: string; type: RelationType };
export type Graph = { topics: Topic[]; concepts: GraphConcept[]; relations: GraphRelation[] };

export type ConceptDetail = {
  concept: {
    id: string;
    courseId: string;
    name: string;
    definition: string;
    kind: ConceptKind;
    topicId: string | null;
    topicName: string | null;
  };
  relations: { id: string; type: RelationType; note: string; direction: "in" | "out"; otherId: string; otherName: string }[];
  passages: { id: string; locator: string; text: string; role: "definizione" | "uso" | "esempio"; sourceTitle: string }[];
};

export type Usage = {
  today: { calls: number; promptTokens: number; completionTokens: number; costUsd: number };
  total: { calls: number; costUsd: number };
  budgetUsd: number;
};

// Stato del Cartografo trasmesso via WebSocket (stessa forma del backend).
export type CartografoState = {
  status: "idle" | "working" | "error";
  sourceId: string | null;
  sourceTitle: string | null;
  step: "coda" | "estrae" | "argomenti" | "fatto" | null;
  window: number;
  windows: number;
  conceptsAdded: number;
  relationsAdded: number;
  recent: string[];
  message: string | null;
  // Revisione del grafo: quando cambia, il grafo si rilegge.
  graphRevision: number;
};

// Errori e codice demo

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const DEMO_CODE_KEY = "aoc-demo-code";
export const DEMO_CODE_EVENT = "aoc:demo-code-required";

export function setDemoCode(code: string) {
  try {
    localStorage.setItem(DEMO_CODE_KEY, code);
  } catch {}
}

export function demoCode(): string | null {
  try {
    return localStorage.getItem(DEMO_CODE_KEY);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  const code = demoCode();
  if (code) headers.set("x-demo-code", code);
  // blocco 2: ruolo simulato, fatto valere dal server
  if (currentRole) headers.set("x-role", currentRole);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network", "The server is not responding. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? { code: "http", message: `Error ${res.status}` };
    if (err.code === "demo_code" && typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_CODE_EVENT));
    throw new ApiError(res.status, err.code, err.message);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

// Rotte

export const api = {
  courses: () => request<{ courses: Course[] }>("/courses").then((r) => r.courses),
  createCourse: (name: string, description = "") => request<Course>("/courses", json("POST", { name, description })),
  sources: (courseId: string) => request<{ sources: Source[] }>(`/courses/${courseId}/sources`).then((r) => r.sources),
  createSource: (courseId: string, data: { title: string; text: string; kind?: "document" | "transcript"; lessonDate?: string }) =>
    request<{ sourceId: string; passages?: number; thin?: number; duplicate?: true }>(`/courses/${courseId}/sources`, json("POST", data)),
  graph: (courseId: string) => request<Graph>(`/courses/${courseId}/graph`),
  concept: (id: string) => request<ConceptDetail>(`/concepts/${id}`),
  updateConcept: (id: string, data: { name?: string; definition?: string }) =>
    request<{ id: string; name: string; definition: string }>(`/concepts/${id}`, json("PATCH", data)),
  deleteConcept: (id: string) => request<{ ok: true }>(`/concepts/${id}`, { method: "DELETE" }),
  usage: () => request<Usage>("/usage"),
};

// fase 03: esame e triplo attacco.

export type RubricItem = { id: string; criterion: string; points: number; expected?: string };
export type RubricInput = { criterion: string; points: number; expected?: string };
export type AttackAgent = "esterno" | "letterale" | "cavillatore";

export type VerdictKind = "supera_soglia" | "prove_insufficienti" | "ambiguita" | "nessun_controesempio" | "incompleta";
export type Verdict = {
  kind: VerdictKind;
  title: string;
  detail: string;
  agent?: AttackAgent;
  model?: string;
  total?: number;
  max?: number;
  threshold?: number;
};
export type VerdictLabel = { kind: VerdictKind; title: string };

export type QuestionVersion = {
  id: string;
  questionId: string;
  version: number;
  text: string;
  rubric: RubricItem[];
  maxPoints: number;
  origin: "docente" | "proposta_approvata" | "proposta_modificata";
  createdAt: string;
};

export type Exam = { id: string; title: string; createdAt: string };
export type ExamQuestion = {
  id: string;
  ordinal: number;
  version: { id: string; version: number; text: string; maxPoints: number };
  lastRun: { id: string; status: RunStatus; onCurrentVersion: boolean; verdicts: VerdictLabel[] } | null;
};

export type RunStatus = "running" | "done" | "error";
export type AttackStatus = "pending" | "running" | "done" | "error";
export type PerCriterion = { id: string; criterion: string; awarded: number; max: number; why: string };
export type Grade = { readingIndex: number; total: number | null; max: number; perCriterion: PerCriterion[]; error: string | null };
export type LetteraleFinding = {
  answer: string;
  citations: { passageId: string; quote: string }[];
  discarded: { passageId: string; quote: string; why: string }[];
  missing: boolean;
};
export type CavillatoreFinding = { found: boolean; phrase: string; assumption: string; readings: { interpretation: string; answer: string }[] };
export type Attack = {
  id: string;
  agent: AttackAgent;
  status: AttackStatus;
  answer: string | null;
  finding: LetteraleFinding | CavillatoreFinding | { answer: string } | null;
  error: string | null;
  model: string;
  grades: Grade[];
};
export type RetrievalReason =
  | { via: "termine"; terms: string[] }
  | { via: "concetto"; concept: string }
  | { via: "vicino"; concept: string; from: string; relation: RelationType };
export type RunPassage = { id: string; rank: number; locator: string; sourceTitle: string; text: string; reasons: RetrievalReason[] };
export type TouchedConcept = { id: string; name: string; via: "diretto" | "vicino"; from?: string; relation?: RelationType };
export type Review = { id: string; verdicts: Verdict[]; proposedText: string | null; rationale: string | null; error: string | null };
export type RunDetail = {
  id: string;
  questionId: string;
  status: RunStatus;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  version: QuestionVersion;
  retrieval: { terms: string[]; concepts: TouchedConcept[]; passages: RunPassage[] } | null;
  attacks: Attack[];
  review: Review | null;
};

export type QuestionDetail = {
  question: { id: string; examId: string; courseId: string; ordinal: number; currentVersionId: string | null };
  version: QuestionVersion | null;
  lastRun: { id: string; status: RunStatus; versionId: string } | null;
  lastDecision: { reviewId: string | null; action: DecisionAction; toVersionId: string | null } | null;
};

export type DecisionAction = "approvata" | "modificata" | "tenuta";
export type VersionOutcome = {
  version: QuestionVersion;
  decision: { action: DecisionAction; createdAt: string } | null;
  outcome: {
    runId: string;
    status: RunStatus;
    agents: { agent: AttackAgent; status: AttackStatus; found?: boolean; grades: { readingIndex: number; total: number | null; max: number }[] }[];
    verdicts: VerdictLabel[];
  } | null;
};

// Stato del coordinatore trasmesso via WebSocket (stessa forma del backend).
export type LiveAgent = { status: AttackStatus; text: string; note: string | null };
export type AttaccoState = {
  runId: string | null;
  status: "idle" | "running" | "done" | "error";
  step: "recupero" | "attacco" | "revisione" | "fatto" | null;
  agents: Record<AttackAgent | "recupero" | "correttore" | "revisore", LiveAgent>;
  version: number;
};

export const esameApi = {
  exams: (courseId: string) => request<{ exams: Exam[] }>(`/courses/${courseId}/exams`).then((r) => r.exams),
  createExam: (courseId: string, title: string) => request<{ id: string; title: string }>(`/courses/${courseId}/exams`, json("POST", { title })),
  exam: (examId: string) => request<{ exam: Exam; questions: ExamQuestion[] }>(`/exams/${examId}`),
  createQuestion: (examId: string, data: { text: string; rubric: RubricInput[] }) =>
    request<{ id: string; versionId: string }>(`/exams/${examId}/questions`, json("POST", data)),
  question: (id: string) => request<QuestionDetail>(`/questions/${id}`),
  attack: (id: string) => request<{ runId: string }>(`/questions/${id}/attack`, { method: "POST" }),
  run: (runId: string) => request<{ run: RunDetail }>(`/runs/${runId}`).then((r) => r.run),
  decide: (id: string, data: { reviewId: string; expectedVersionId: string; action: DecisionAction; text?: string }) =>
    request<{ versionId: string; decisionId: string }>(`/questions/${id}/decision`, json("POST", data)),
  versions: (id: string) => request<{ versions: VersionOutcome[] }>(`/questions/${id}/versions`).then((r) => r.versions),
};
// fine fase 03

// blocco 2: ruolo simulato, classe simulata, lezioni.

// Il selettore di ruolo del guscio lo imposta; il server con ruolo studente risponde 403 a
// scritture, esame e classe.
let currentRole: string | null = null;
export function setApiRole(role: string) {
  currentRole = role;
}
export function apiRole(): string | null {
  return currentRole;
}

export type Student = { id: string; name: string; priorGrade: number; style: string; lessons: { id: string; title: string }[] };
export type ClassAnswerStatus = "pending" | "running" | "done" | "error";
export type ClassAnswer = {
  id: string;
  studentId: string;
  status: ClassAnswerStatus;
  answer: string | null;
  passageIds: string[];
  missing: { id: string; name: string }[];
  total: number | null;
  max: number | null;
  perCriterion: PerCriterion[];
  error: string | null;
};
export type ClassPassage = { id: string; rank: number; locator: string; sourceId: string; sourceTitle: string; text: string };
export type Gap = { missingCount: number; avgMissing: number | null; avgFollowed: number | null };
export type ClassSummary = {
  graded: number;
  max: number;
  mean: number | null;
  bands: { label: string; count: number }[];
  criteria: { id: string; criterion: string; max: number; avg: number }[];
  gaps: ({ id: string; name: string } & Gap)[];
  lessons: ({ id: string; title: string } & Gap)[];
};
export type ClassRunDetail = {
  id: string;
  questionId: string;
  status: RunStatus;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  version: QuestionVersion;
  retrieval: { terms: string[]; concepts: TouchedConcept[] } | null;
  passages: ClassPassage[];
  students: Student[];
  answers: ClassAnswer[];
  summary: ClassSummary | null;
};
export type LiveStudent = { status: "pending" | "running" | "grading" | "done" | "error"; text: string; note: string | null };
export type ClasseState = {
  runId: string | null;
  status: "idle" | "running" | "done" | "error";
  step: "recupero" | "risposte" | "fatto" | null;
  students: Record<string, LiveStudent>;
  version: number;
};

export const classeApi = {
  students: (courseId: string) => request<{ students: Student[] }>(`/courses/${courseId}/students`).then((r) => r.students),
  start: (questionId: string) => request<{ runId: string }>(`/questions/${questionId}/class`, { method: "POST" }),
  last: (questionId: string) =>
    request<{ lastRun: { id: string; status: RunStatus; versionId: string } | null }>(`/questions/${questionId}/class`).then((r) => r.lastRun),
  run: (runId: string) => request<{ run: ClassRunDetail }>(`/class-runs/${runId}`).then((r) => r.run),
};

export type Lesson = {
  id: string;
  kind: "document" | "transcript";
  title: string;
  status: SourceStatus;
  createdAt: string;
  doneAt: string | null;
  conceptCount: number;
};
export type Proposal = {
  id: string;
  name: string;
  kind: ConceptKind;
  definition: string;
  topicName: string | null;
  evidence: number;
  degree: number;
  asked: boolean;
  passages: { id: string; locator: string; text: string; sourceTitle: string }[];
};

export const lezioniApi = {
  lessons: (courseId: string) => request<{ lessons: Lesson[] }>(`/courses/${courseId}/lessons`).then((r) => r.lessons),
  setDone: (sourceId: string, done: boolean) => request<{ id: string; done: boolean }>(`/sources/${sourceId}/done`, json("PUT", { done })),
  proposals: (courseId: string) =>
    request<{ totals: { concepts: number; covered: number; lessonsDone: number }; proposals: Proposal[] }>(`/courses/${courseId}/proposals`),
  transcribe: (courseId: string, audio: string) =>
    request<{ text: string; seconds: number; costUsd: number | null }>(`/courses/${courseId}/lessons/transcribe`, json("POST", { audio, format: "wav" })),
};
// fine blocco 2

// blocco 3: piano di studio dello studente.
export type StudioOptions = {
  scope: "svolte" | "tutte";
  lessons: { id: string; title: string; short: string; done: boolean; concepts: number }[];
  concepts: { id: string; name: string; lessonId: string | null; evidence: number }[];
  maxDays: number;
};
export type StudyPassage = { id: string; locator: string; sourceTitle: string; text: string };
export type StudySession = {
  id: string;
  ordinal: number;
  day: number;
  status: "pending" | "running" | "done" | "error";
  error: string | null;
  why: string | null;
  concepts: { id: string; name: string; topicName: string | null; lesson: string | null; evidence: number; after: string[] }[];
  look: { note: string; passage: StudyPassage }[];
};
export type StudyPlan = {
  id: string;
  days: number;
  scope: "svolte" | "tutte";
  knownLessons: string[];
  knownConcepts: string[];
  stats: { inScope: number; known: number; toStudy: number; withoutEvidence: number; edges: number; cyclesBroken: number };
  status: RunStatus;
  error: string | null;
  createdAt: string;
  sessions: StudySession[];
};
export type PianificatoreState = {
  planId: string | null;
  status: "idle" | "running" | "done" | "error";
  sessions: Record<string, { status: StudySession["status"]; text: string }>;
  version: number;
};

export const studioApi = {
  options: (courseId: string) => request<StudioOptions>(`/courses/${courseId}/studio`),
  create: (courseId: string, data: { days: number; knownLessons: string[]; knownConcepts: string[] }) =>
    request<{ planId: string }>(`/courses/${courseId}/study-plans`, json("POST", data)),
  plan: (planId: string) => request<{ plan: StudyPlan }>(`/study-plans/${planId}`).then((r) => r.plan),
};
// fine blocco 3
