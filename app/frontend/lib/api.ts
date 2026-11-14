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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network", "Il server non risponde. Controlla la connessione e riprova.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? { code: "http", message: `Errore ${res.status}` };
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
