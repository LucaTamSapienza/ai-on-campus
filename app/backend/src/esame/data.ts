// Letture dell'esame da D1, condivise fra rotte e coordinatore, e calcolo dei verdetti.
import { modelFor, type CavillatoreFinding, type LetteraleFinding, type PerCriterion, type RubricItem } from "./agents";
import type { Reason, TouchedConcept } from "./retrieval";

export const AGENTS = ["esterno", "letterale", "cavillatore"] as const;
export type AttackAgent = (typeof AGENTS)[number];
export const PASS_THRESHOLD = 0.7;

export type VersionRow = {
  id: string;
  questionId: string;
  version: number;
  text: string;
  rubric: RubricItem[];
  maxPoints: number;
  origin: string;
  createdAt: string;
};

export type Grade = {
  readingIndex: number;
  total: number | null;
  max: number;
  perCriterion: PerCriterion[];
  error: string | null;
};

export type Attack = {
  id: string;
  agent: AttackAgent;
  status: "pending" | "running" | "done" | "error";
  answer: string | null;
  finding: LetteraleFinding | CavillatoreFinding | { answer: string } | null;
  error: string | null;
  model: string;
  grades: Grade[];
};

export type Verdict = {
  kind: "supera_soglia" | "prove_insufficienti" | "ambiguita" | "nessun_controesempio" | "incompleta";
  title: string;
  detail: string;
  agent?: AttackAgent;
  model?: string;
  total?: number;
  max?: number;
  threshold?: number;
};

export type RunPassage = { id: string; rank: number; locator: string; sourceTitle: string; text: string; reasons: Reason[] };

export type RunDetail = {
  id: string;
  questionId: string;
  status: "running" | "done" | "error";
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  version: VersionRow;
  retrieval: { terms: string[]; concepts: TouchedConcept[]; passages: RunPassage[] } | null;
  attacks: Attack[];
  review: { id: string; verdicts: Verdict[]; proposedText: string | null; rationale: string | null; error: string | null } | null;
};

const parse = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export async function loadVersion(db: D1Database, id: string): Promise<VersionRow | null> {
  const r = await db
    .prepare(
      `SELECT id, question_id AS questionId, version, text, rubric, max_points AS maxPoints, origin, created_at AS createdAt
         FROM question_versions WHERE id = ?`,
    )
    .bind(id)
    .first<Omit<VersionRow, "rubric"> & { rubric: string }>();
  return r ? { ...r, rubric: parse<RubricItem[]>(r.rubric, []) } : null;
}

export async function loadRun(db: D1Database, runId: string): Promise<RunDetail | null> {
  const run = await db
    .prepare(
      `SELECT id, question_id AS questionId, question_version_id AS versionId, status, error, retrieval,
              created_at AS createdAt, finished_at AS finishedAt FROM attack_runs WHERE id = ?`,
    )
    .bind(runId)
    .first<{
      id: string;
      questionId: string;
      versionId: string;
      status: RunDetail["status"];
      error: string | null;
      retrieval: string | null;
      createdAt: string;
      finishedAt: string | null;
    }>();
  if (!run) return null;
  const version = await loadVersion(db, run.versionId);
  if (!version) return null;

  const [passages, attacks, grades, review] = await db.batch([
    db
      .prepare(
        `SELECT p.id, rp.rank, p.locator, s.title AS sourceTitle, p.text, rp.reason
           FROM run_passages rp JOIN passages p ON p.id = rp.passage_id JOIN sources s ON s.id = p.source_id
          WHERE rp.run_id = ? ORDER BY rp.rank`,
      )
      .bind(runId),
    db.prepare("SELECT id, agent, status, answer, finding, error FROM attacks WHERE run_id = ?").bind(runId),
    db
      .prepare(
        `SELECT g.attack_id AS attackId, g.reading_index AS readingIndex, g.total, g.max, g.per_criterion AS perCriterion, g.error
           FROM grades g JOIN attacks a ON a.id = g.attack_id WHERE a.run_id = ? ORDER BY g.reading_index`,
      )
      .bind(runId),
    db.prepare("SELECT id, verdicts, proposed_text AS proposedText, rationale, error FROM reviews WHERE run_id = ?").bind(runId),
  ]);

  const gradeRows = grades.results as { attackId: string; readingIndex: number; total: number | null; max: number; perCriterion: string; error: string | null }[];
  const order = (a: string) => AGENTS.indexOf(a as AttackAgent);
  const retrievalMeta = parse<{ terms: string[]; concepts: TouchedConcept[] } | null>(run.retrieval, null);

  const reviewRow = review.results[0] as { id: string; verdicts: string; proposedText: string | null; rationale: string | null; error: string | null } | undefined;
  return {
    id: run.id,
    questionId: run.questionId,
    status: run.status,
    error: run.error,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
    version,
    retrieval: retrievalMeta
      ? {
          ...retrievalMeta,
          passages: (passages.results as (Omit<RunPassage, "reasons"> & { reason: string })[]).map(({ reason, ...p }) => ({
            ...p,
            reasons: parse<Reason[]>(reason, []),
          })),
        }
      : null,
    attacks: (attacks.results as { id: string; agent: AttackAgent; status: Attack["status"]; answer: string | null; finding: string | null; error: string | null }[])
      .sort((a, b) => order(a.agent) - order(b.agent))
      .map((a) => ({
        ...a,
        finding: parse(a.finding, null),
        model: modelFor(a.agent),
        grades: gradeRows
          .filter((g) => g.attackId === a.id)
          .map((g) => ({ readingIndex: g.readingIndex, total: g.total, max: g.max, perCriterion: parse<PerCriterion[]>(g.perCriterion, []), error: g.error })),
      })),
    review: reviewRow ? { ...reviewRow, verdicts: parse<Verdict[]>(reviewRow.verdicts, []) } : null,
  };
}

// Le risposte da correggere di un attacco: una per Esterno e Letterale, due per il Cavillatore
// che ha trovato due letture, nessuna se non le ha trovate.
export function answersToGrade(agent: AttackAgent, finding: Attack["finding"], answer: string | null): string[] {
  if (agent === "cavillatore") {
    const f = finding as CavillatoreFinding | null;
    return f?.found ? f.readings.map((r) => `${r.interpretation}\n\n${r.answer}`) : [];
  }
  return answer ? [answer] : [];
}

const NAMES: Record<AttackAgent, string> = { esterno: "The Outsider", letterale: "The Literalist", cavillatore: "The Quibbler" };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Copertura del corso, dai dati salvati: quanti passaggi ha dato il recupero e se il Letterale
// ha trovato abbastanza. passages è null per le esecuzioni senza recupero salvato.
export function courseCoverage(run: Pick<RunDetail, "attacks" | "retrieval">): { passages: number | null; insufficient: boolean } {
  const passages = run.retrieval ? run.retrieval.passages.length : null;
  const letterale = run.attacks.find((a) => a.agent === "letterale");
  const lf = letterale?.status === "done" ? (letterale.finding as LetteraleFinding | null) : null;
  const insufficient = passages === 0 || (!!lf && (lf.missing || lf.citations.length === 0));
  return { passages, insufficient };
}

// I verdetti li calcola il backend sui voti, con parole fisse.
export function computeVerdicts(run: Pick<RunDetail, "attacks" | "version" | "retrieval">): Verdict[] {
  const out: Verdict[] = [];
  const failed: string[] = [];
  const get = (agent: AttackAgent) => run.attacks.find((a) => a.agent === agent);

  const esterno = get("esterno");
  const eg = esterno?.grades.find((g) => g.readingIndex === 0);
  if (esterno?.status !== "done" || !eg || eg.total === null) {
    failed.push(`${NAMES.esterno} did not finish${esterno?.error ? `: ${esterno.error}` : eg?.error ? `: grading failed, ${eg.error}` : ""}`);
  } else if (eg.total >= PASS_THRESHOLD * eg.max) {
    const threshold = Math.round(PASS_THRESHOLD * eg.max * 10) / 10;
    out.push({
      kind: "supera_soglia",
      title: "This model clears the pass mark without the course materials",
      detail: `${esterno.model} scores ${fmt(eg.total)} out of ${fmt(eg.max)} without seeing the course. Pass mark: ${fmt(threshold)} (70%).`,
      agent: "esterno",
      model: esterno.model,
      total: eg.total,
      max: eg.max,
      threshold,
    });
  }

  const letterale = get("letterale");
  const lf = letterale?.finding as LetteraleFinding | null | undefined;
  const coverage = courseCoverage(run);
  if (letterale?.status !== "done" || !lf) {
    failed.push(`${NAMES.letterale} did not finish${letterale?.error ? `: ${letterale.error}` : ""}`);
  } else if (!coverage.insufficient && !letterale.grades.some((g) => g.total !== null)) {
    failed.push(`${NAMES.letterale}: grading failed`);
  }
  // Prove insufficienti: nessun passaggio recuperato, nessuna citazione verificata, oppure il
  // Letterale dichiara che i passaggi non bastano. Si calcola sui dati salvati, senza modello.
  if (coverage.insufficient) {
    const discarded = lf?.discarded.length ?? 0;
    const why =
      coverage.passages === 0
        ? "Retrieval found no course passages for this question"
        : lf && lf.citations.length === 0
          ? `The Literalist found no verifiable sentences in the retrieved passages${
              discarded === 1 ? " (1 citation discarded because it is not in the passages)" : discarded ? ` (${discarded} citations discarded because they are not in the passages)` : ""
            }`
          : `The Literalist verified ${lf!.citations.length} ${lf!.citations.length === 1 ? "sentence" : "sentences"} but declared the retrieved passages not enough to answer`;
    out.push({
      kind: "prove_insufficienti",
      title: "Insufficient evidence in the retrieved passages",
      detail: `${why}. This does not mean the topic is missing from the course: retrieval may not have found it.`,
      agent: "letterale",
    });
  }

  const cav = get("cavillatore");
  const cf = cav?.finding as CavillatoreFinding | null | undefined;
  if (cav?.status !== "done" || !cf) {
    failed.push(`${NAMES.cavillatore} did not finish${cav?.error ? `: ${cav.error}` : ""}`);
  } else if (cf.found) {
    const totals = [0, 1].map((i) => cav.grades.find((g) => g.readingIndex === i));
    const marks = totals.map((g) => (g && g.total !== null ? `${fmt(g.total)}/${fmt(g.max)}` : "grading failed"));
    out.push({
      kind: "ambiguita",
      title: "Candidate ambiguity",
      detail: `“${cf.phrase}”: ${cf.assumption.replace(/[.\s]+$/, "")}. Reading 1: ${marks[0]}; reading 2: ${marks[1]}. The teacher decides.`,
      agent: "cavillatore",
    });
    if (totals.some((g) => !g || g.total === null)) failed.push(`${NAMES.cavillatore}: grading of one reading failed`);
  }

  if (failed.length) {
    out.push({ kind: "incompleta", title: "Incomplete analysis", detail: `${failed.join("; ")}.` });
  } else if (out.length === 0) {
    out.push({
      kind: "nessun_controesempio",
      title: "No counterexample found",
      detail: "All three attacks finished and were graded, and none found a flaw. This is not a guarantee, only the outcome of these three attacks.",
    });
  }
  return out;
}
