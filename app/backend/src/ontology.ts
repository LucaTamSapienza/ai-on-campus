// Validazione e scrittura dell'ontologia, unica per il Cartografo e per l'import della rotta /ontology.
// Tutto ciò che arriva da un modello o da un file passa da qui prima di toccare D1.
import { z } from "zod";

export const CONCEPT_KINDS = ["concetto", "metodo", "risultato", "esempio"] as const;
export const EVIDENCE_ROLES = ["definizione", "uso", "esempio"] as const;
export const RELATION_TYPES = ["prerequisito", "parte_di", "generalizza", "usa", "contrasta"] as const;

export const MAX_TOPICS = 12;

// Schema comune: un concetto con le sue prove già risolte in id di passaggio.
export const conceptDraft = z.object({
  name: z.string().trim().min(1).max(120),
  definition: z.string().trim().max(800).default(""),
  kind: z.enum(CONCEPT_KINDS).catch("concetto"),
  topic: z.string().trim().max(120).optional(),
  evidence: z.array(z.object({ passageId: z.string(), role: z.enum(EVIDENCE_ROLES).catch("uso") })).max(40),
});
export const relationDraft = z.object({
  from: z.string().trim().min(1).max(120),
  to: z.string().trim().min(1).max(120),
  type: z.enum(RELATION_TYPES),
  note: z.string().trim().max(400).default(""),
  passageId: z.string().nullable(),
});
export type ConceptDraft = z.infer<typeof conceptDraft>;
export type RelationDraft = z.infer<typeof relationDraft>;

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export type Rejected = { kind: "concetto" | "relazione" | "prova"; name: string; reason: string };
export type WriteResult = { added: string[]; updated: number; relations: number; discarded: number; rejected: Rejected[] };

// Scrive concetti e relazioni nel corso. allowedPassages: gli unici passaggi ammessi come prova
// (la finestra del Cartografo, o i passaggi del corso per l'import). overwrite: l'import aggiorna
// definizione, tipo e argomento dei concetti esistenti; il Cartografo aggiunge solo prove.
export async function writeOntology(
  db: D1Database,
  courseId: string,
  input: { concepts: unknown[]; relations: unknown[] },
  allowedPassages: Set<string>,
  opts: { overwrite: boolean; topicIds?: Map<string, string> },
): Promise<WriteResult> {
  const existing = await db
    .prepare("SELECT id, slug FROM concepts WHERE course_id = ?")
    .bind(courseId)
    .all<{ id: string; slug: string }>();
  const bySlug = new Map(existing.results.map((r) => [r.slug, r.id]));
  const relationSlugs = new Set<string>();
  const stmts: D1PreparedStatement[] = [];
  const added: string[] = [];
  let updated = 0;
  let discarded = 0;
  const rejected: Rejected[] = [];
  const reject = (kind: Rejected["kind"], name: string, reason: string) => {
    discarded++;
    if (rejected.length < 300) rejected.push({ kind, name: String(name).slice(0, 120), reason });
  };

  for (const raw of input.concepts) {
    const parsed = conceptDraft.safeParse(raw);
    if (!parsed.success) {
      reject("concetto", (raw as { name?: string })?.name ?? "?", "schema non valido");
      continue;
    }
    const c = parsed.data;
    const slug = slugify(c.name);
    const evidence = c.evidence.filter((e) => allowedPassages.has(e.passageId));
    if (!slug) {
      reject("concetto", c.name, "nome non valido");
      continue;
    }
    if (evidence.length === 0) {
      reject("concetto", c.name, "nessuna prova valida");
      continue;
    }
    const topicId = c.topic ? (opts.topicIds?.get(c.topic.toLowerCase()) ?? null) : null;
    let id = bySlug.get(slug);
    if (!id) {
      id = crypto.randomUUID();
      bySlug.set(slug, id);
      added.push(c.name);
      stmts.push(
        db
          .prepare("INSERT INTO concepts (id, course_id, topic_id, name, slug, definition, kind) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, courseId, topicId, c.name, slug, c.definition, c.kind),
      );
    } else {
      updated++;
      if (opts.overwrite) {
        stmts.push(
          db
            .prepare("UPDATE concepts SET name = ?, definition = ?, kind = ?, topic_id = COALESCE(?, topic_id) WHERE id = ? AND course_id = ?")
            .bind(c.name, c.definition, c.kind, topicId, id, courseId),
        );
      } else if (c.definition) {
        stmts.push(db.prepare("UPDATE concepts SET definition = ? WHERE id = ? AND definition = ''").bind(c.definition, id));
      }
    }
    for (const e of evidence) {
      stmts.push(
        db.prepare("INSERT OR IGNORE INTO concept_passages (concept_id, passage_id, role) VALUES (?, ?, ?)").bind(id, e.passageId, e.role),
      );
    }
  }

  let relations = 0;
  for (const raw of input.relations) {
    const parsed = relationDraft.safeParse(raw);
    const label = `${(raw as { from?: string })?.from ?? "?"} → ${(raw as { to?: string })?.to ?? "?"}`;
    if (!parsed.success) {
      reject("relazione", label, "schema o tipo non valido");
      continue;
    }
    const r = parsed.data;
    const from = bySlug.get(slugify(r.from));
    const to = bySlug.get(slugify(r.to));
    const key = `${from}|${to}|${r.type}`;
    if (!from || !to) {
      reject("relazione", label, `concetto non trovato: ${!from ? r.from : r.to}`);
      continue;
    }
    if (from === to) {
      reject("relazione", label, "autoanello");
      continue;
    }
    if (relationSlugs.has(key)) continue;
    relationSlugs.add(key);
    relations++;
    const passageId = r.passageId && allowedPassages.has(r.passageId) ? r.passageId : null;
    stmts.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO relations (id, course_id, from_concept_id, to_concept_id, type, note, passage_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(crypto.randomUUID(), courseId, from, to, r.type, r.note, passageId),
    );
  }

  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return { added, updated, relations, discarded, rejected };
}

// Crea gli argomenti che mancano (per nome, senza distinzione di maiuscole) fino a MAX_TOPICS.
// Restituisce la mappa nome minuscolo -> id di tutti gli argomenti del corso.
export async function upsertTopics(
  db: D1Database,
  courseId: string,
  topics: { name: string; summary?: string }[],
): Promise<Map<string, string>> {
  const rows = await db
    .prepare("SELECT id, name, ordinal FROM topics WHERE course_id = ? ORDER BY ordinal")
    .bind(courseId)
    .all<{ id: string; name: string; ordinal: number }>();
  const map = new Map(rows.results.map((r) => [r.name.toLowerCase(), r.id]));
  let ordinal = rows.results.length;
  const stmts: D1PreparedStatement[] = [];
  for (const t of topics) {
    const name = String(t.name ?? "").trim().slice(0, 120);
    if (!name || map.has(name.toLowerCase()) || map.size >= MAX_TOPICS) continue;
    const id = crypto.randomUUID();
    map.set(name.toLowerCase(), id);
    stmts.push(
      db
        .prepare("INSERT INTO topics (id, course_id, name, summary, ordinal) VALUES (?, ?, ?, ?, ?)")
        .bind(id, courseId, name, String(t.summary ?? "").trim().slice(0, 400), ordinal++),
    );
  }
  if (stmts.length) await db.batch(stmts);
  return map;
}
