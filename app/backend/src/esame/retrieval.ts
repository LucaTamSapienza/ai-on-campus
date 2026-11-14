// Recupero dei passaggi del corso per una domanda, senza embedding: ricerca a testo pieno (FTS5)
// con i termini, più i passaggi di prova dei concetti nominati e dei loro vicini di primo grado.
// Ogni passaggio porta il perché: un termine, un concetto o un arco del grafo.

export const MAX_PASSAGES = 12;
const MAX_CHARS = 14_000;
const MAX_PASSAGE_CHARS = 2_000;

export type Reason =
  | { via: "termine"; terms: string[] }
  | { via: "concetto"; concept: string }
  | { via: "vicino"; concept: string; from: string; relation: string };

export type RetrievedPassage = { id: string; reasons: Reason[] };
export type TouchedConcept = { id: string; name: string; via: "diretto" | "vicino"; from?: string; relation?: string };

// Pulisce un termine per FTS5: niente sintassi (virgolette, asterischi, parentesi, due punti),
// poi lo mette fra virgolette. Il trattino resta dentro la frase: "Q-learning" cerca "q learning".
export function ftsPhrase(term: string): string | null {
  const clean = term
    .replace(/[^\p{L}\p{N}\s\-'_.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (clean.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return null;
  return `"${clean}"`;
}

const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

// Token della domanda che hanno l'aria di termini tecnici in qualunque lingua: Q-learning, GLIE, L08.
export function technicalTokens(question: string): string[] {
  const found = question.match(/\b[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)+\b|\b[A-Z]{2,}[a-z]?\b|\bL\d{2}\b/gu) ?? [];
  return [...new Set(found)];
}

export async function retrievePassages(
  db: D1Database,
  courseId: string,
  question: string,
  terms: string[],
): Promise<{ passages: RetrievedPassage[]; concepts: TouchedConcept[] }> {
  const allTerms = [...new Set([...terms, ...technicalTokens(question)].map((t) => t.trim()).filter(Boolean))];
  // Frasi intere più le singole parole dei termini: "policy improvement theorem" trova anche la
  // slide che dice solo "Policy Improvement". Il ranking BM25 premia chi le ha tutte.
  const words = allTerms.flatMap((t) => t.split(/[\s()/,]+/)).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length >= 4 && !STOP.has(w.toLowerCase()));
  const phrases = [...new Set([...allTerms, ...words].map(ftsPhrase).filter((p): p is string => !!p))];

  // Se la domanda nomina una lezione (L08), il recupero resta dentro quella lezione.
  const lessons = (question.match(/\bL\d{2}\b/g) ?? []).map((l) => l.toLowerCase());
  const lessonSources = lessons.length
    ? (
        await db
          .prepare(`SELECT id FROM sources WHERE course_id = ? AND (${lessons.map(() => "LOWER(title) LIKE ?").join(" OR ")})`)
          .bind(courseId, ...lessons.map((l) => `${l}%`))
          .all<{ id: string }>()
      ).results.map((r) => r.id)
    : [];
  const scope = lessonSources.length ? ` AND p.source_id IN (${lessonSources.map(() => "?").join(",")})` : "";

  // 1. Concetti nominati nella domanda o fra i termini, e i loro vicini di primo grado.
  const concepts = (
    await db.prepare("SELECT id, name FROM concepts WHERE course_id = ?").bind(courseId).all<{ id: string; name: string }>()
  ).results;
  const haystack = ` ${norm(question)} | ${allTerms.map(norm).join(" | ")} `;
  const direct = concepts
    .filter((c) => norm(c.name).length >= 3 && haystack.includes(norm(c.name)))
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 6);
  const touched: TouchedConcept[] = direct.map((c) => ({ id: c.id, name: c.name, via: "diretto" }));

  let neighbors: { id: string; name: string; from: string; relation: string }[] = [];
  if (direct.length) {
    const ids = direct.map((c) => c.id);
    const marks = ids.map(() => "?").join(",");
    neighbors = (
      await db
        .prepare(
          `SELECT o.id, o.name, f.name AS "from", r.type AS relation
             FROM relations r JOIN concepts o ON o.id = r.to_concept_id JOIN concepts f ON f.id = r.from_concept_id
            WHERE r.from_concept_id IN (${marks})
           UNION
           SELECT o.id, o.name, f.name AS "from", r.type AS relation
             FROM relations r JOIN concepts o ON o.id = r.from_concept_id JOIN concepts f ON f.id = r.to_concept_id
            WHERE r.to_concept_id IN (${marks})`,
        )
        .bind(...ids, ...ids)
        .all<{ id: string; name: string; from: string; relation: string }>()
    ).results.filter((n, i, all) => !ids.includes(n.id) && all.findIndex((x) => x.id === n.id) === i);
    neighbors = neighbors.slice(0, 6);
    touched.push(...neighbors.map((n) => ({ id: n.id, name: n.name, via: "vicino" as const, from: n.from, relation: n.relation })));
  }

  const evidenceFor = async (ids: string[], perConcept: number) => {
    if (!ids.length) return new Map<string, string[]>();
    const rows = (
      await db
        .prepare(
          `SELECT cp.concept_id AS conceptId, cp.passage_id AS passageId FROM concept_passages cp
             JOIN passages p ON p.id = cp.passage_id
            WHERE cp.concept_id IN (${ids.map(() => "?").join(",")}) AND p.course_id = ? AND p.thin = 0${scope}
            ORDER BY CASE cp.role WHEN 'definizione' THEN 0 WHEN 'esempio' THEN 1 ELSE 2 END, p.ordinal`,
        )
        .bind(...ids, courseId, ...lessonSources)
        .all<{ conceptId: string; passageId: string }>()
    ).results;
    const out = new Map<string, string[]>();
    for (const r of rows) {
      const list = out.get(r.conceptId) ?? [];
      if (list.length < perConcept) list.push(r.passageId);
      out.set(r.conceptId, list);
    }
    return out;
  };
  const directEvidence = await evidenceFor(direct.map((c) => c.id), 2);
  const neighborEvidence = await evidenceFor(neighbors.map((n) => n.id), 1);

  // 2. Ricerca a testo pieno, con ranking BM25.
  let fts: { id: string; text: string }[] = [];
  if (phrases.length) {
    fts = (
      await db
        .prepare(
          `SELECT passages_fts.passage_id AS id, p.text FROM passages_fts
             JOIN passages p ON p.rowid = passages_fts.rowid
            WHERE passages_fts MATCH ? AND p.course_id = ? AND p.thin = 0${scope}
            ORDER BY bm25(passages_fts) LIMIT 30`,
        )
        .bind(phrases.join(" OR "), courseId, ...lessonSources)
        .all<{ id: string; text: string }>()
    ).results;
  }

  // 3. Unione, deduplicazione e tetti: prima le definizioni dei concetti nominati, poi il testo pieno,
  // poi i vicini. Al massimo 12 passaggi.
  const picked = new Map<string, Reason[]>();
  const add = (id: string, reason: Reason) => {
    const list = picked.get(id);
    if (list) list.push(reason);
    else if (picked.size < MAX_PASSAGES * 2) picked.set(id, [reason]);
  };
  for (const c of direct) for (const pid of (directEvidence.get(c.id) ?? []).slice(0, 1)) add(pid, { via: "concetto", concept: c.name });
  for (const r of fts) {
    const text = norm(r.text);
    const matched = allTerms.filter((t) => text.includes(norm(t)));
    add(r.id, { via: "termine", terms: matched.length ? matched : allTerms.slice(0, 1) });
  }
  for (const c of direct) for (const pid of (directEvidence.get(c.id) ?? []).slice(1)) add(pid, { via: "concetto", concept: c.name });
  for (const n of neighbors) {
    for (const pid of neighborEvidence.get(n.id) ?? []) add(pid, { via: "vicino", concept: n.name, from: n.from, relation: n.relation });
  }

  const ids = [...picked.keys()];
  const lengths = ids.length
    ? new Map(
        (
          await db
            .prepare(`SELECT id, LENGTH(text) AS n FROM passages WHERE id IN (${ids.map(() => "?").join(",")})`)
            .bind(...ids)
            .all<{ id: string; n: number }>()
        ).results.map((r) => [r.id, Math.min(r.n, MAX_PASSAGE_CHARS)]),
      )
    : new Map<string, number>();
  const passages: RetrievedPassage[] = [];
  let chars = 0;
  for (const id of ids) {
    const n = lengths.get(id) ?? 0;
    if (passages.length >= MAX_PASSAGES || (passages.length && chars + n > MAX_CHARS)) continue;
    passages.push({ id, reasons: picked.get(id)! });
    chars += n;
  }
  return { passages, concepts: touched };
}

const STOP = new Set(["with", "from", "that", "this", "into", "over", "under", "between", "learning", "method", "methods"]);

export function clipPassage(text: string) {
  return text.length > MAX_PASSAGE_CHARS ? `${text.slice(0, MAX_PASSAGE_CHARS)}…` : text;
}
