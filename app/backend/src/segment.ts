// Passo 1 del Cartografo, solo codice: il testo di una fonte diventa passaggi numerati.

export type PassageDraft = { locator: string; text: string; thin?: boolean };

// Sotto questa soglia (caratteri non di spazio) una slide ha solo titolo o figure: testo non estratto.
const THIN_CHARS = 40;

const MAX_PASSAGE_CHARS = 4000;
const BLOCK_CHARS = 1200;

export function segment(raw: string, redactTerms: string[] = []): PassageDraft[] {
  let text = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  for (const term of redactTerms) {
    if (term.length < 3) continue;
    text = text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[teacher]");
  }

  let parts: PassageDraft[];
  const slides = [...text.matchAll(/^##\s+Slide\s+(\d+)\s*$/gim)];
  if (slides.length > 0) {
    parts = slides.map((m, i) => ({
      locator: `slide ${m[1]}`,
      text: text.slice(m.index! + m[0].length, slides[i + 1]?.index ?? text.length),
    }));
  } else if (/^#{1,6}\s+\S/m.test(text)) {
    parts = text
      .split(/^(?=#{1,6}\s+\S)/m)
      .flatMap((section) => blocks(section))
      .map((t, i) => ({ locator: `part ${i + 1}`, text: t }));
  } else {
    parts = blocks(text).map((t, i) => ({ locator: `block ${i + 1}`, text: t }));
  }

  parts = dropRepeatedLines(parts.map((p) => ({ ...p, text: tidy(p.text) })));
  // Le slide restano tutte, anche vuote, così la numerazione resta quella del docente.
  return parts
    .map((p) => {
      const text = tidy(p.text).slice(0, MAX_PASSAGE_CHARS);
      return { locator: p.locator, text, thin: text.replace(/\s/g, "").length < THIN_CHARS };
    })
    .filter((p) => slides.length > 0 || p.text.length > 0);
}

// Spazi di impaginazione compressi, righe vuote multiple ridotte a una.
function tidy(t: string): string {
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Blocchi di paragrafi fino a circa BLOCK_CHARS caratteri.
function blocks(t: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of t.split(/\n\s*\n/)) {
    if (cur && cur.length + para.length > BLOCK_CHARS) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// Toglie le righe che si ripetono in quasi tutti i passaggi (piè di pagina, intestazioni fisse).
function dropRepeatedLines(parts: PassageDraft[]): PassageDraft[] {
  if (parts.length < 4) return parts;
  const key = (l: string) => l.replace(/\d+/g, "#").trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const p of parts) {
    for (const k of new Set(p.text.split("\n").map(key).filter(Boolean))) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(3, parts.length * 0.5);
  return parts.map((p) => ({
    ...p,
    text: p.text
      .split("\n")
      .filter((l) => (counts.get(key(l)) ?? 0) < threshold)
      .join("\n"),
  }));
}
