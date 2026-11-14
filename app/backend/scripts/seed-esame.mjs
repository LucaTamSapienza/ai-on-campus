#!/usr/bin/env node
// Semina l'esame della demo: un appello con le tre domande, chiamando l'API come fa il docente.
//
//   node scripts/seed-esame.mjs [--api http://localhost:8787] [--code <codice demo>]
//
// Usa il primo corso. Se esiste già un esame con lo stesso titolo non fa niente.

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const API = (opt("--api") ?? "http://localhost:8787").replace(/\/$/, "");
const code = opt("--code") ?? process.env.DEMO_CODE;

async function call(path, init = {}) {
  const headers = { "content-type": "application/json", ...(code ? { "x-demo-code": code } : {}) };
  const res = await fetch(`${API}/api${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${body?.error?.message ?? ""}`);
  return body;
}

const EXAM_TITLE = "Appello di prova";

// Tre domande da 10 punti: una che un modello generico risolve senza il corso (A), una con
// un'assunzione nascosta (B), una che dipende da ciò che è specifico del corso (C).
const QUESTIONS = [
  {
    text: "In Q-learning tabulare, Q(s,a)=2, alpha=0,5, gamma=0,9. Una transizione non terminale dà ricompensa 1 e max_b Q(s',b)=4. Calcola il nuovo Q(s,a), mostra target ed errore TD e spiega perché il metodo è off-policy.",
    rubric: [
      { criterion: "Target TD", points: 2, expected: "target = r + gamma * max_b Q(s',b) = 1 + 0,9 * 4 = 4,6" },
      { criterion: "Errore TD", points: 2, expected: "delta = target - Q(s,a) = 4,6 - 2 = 2,6" },
      { criterion: "Nuovo valore", points: 3, expected: "Q(s,a) = 2 + 0,5 * 2,6 = 3,3" },
      { criterion: "Off-policy", points: 3, expected: "il target usa la politica greedy (max), distinta dalla politica che raccoglie i dati (per esempio epsilon-greedy)" },
    ],
  },
  {
    text: "Una transizione conclude l'episodio del simulatore. Q(s,a)=2, alpha=0,5, gamma=0,9, ricompensa 1; prima del reset la tabella riporta max_b Q(s',b)=4. Esegui l'aggiornamento Q-learning e giustifica il target.",
    rubric: [
      { criterion: "Assunzione esplicita", points: 2, expected: "dice se la fine dell'episodio è uno stato terminale vero o un'interruzione esterna (timeout, troncamento)" },
      { criterion: "Formula coerente con l'assunzione", points: 3, expected: "terminale: target = r; troncamento: target = r + gamma * max_b Q(s',b)" },
      { criterion: "Risultato coerente", points: 3, expected: "1,5 se terminale (target 1), oppure 3,3 se troncamento (target 4,6)" },
      { criterion: "Bootstrap", points: 2, expected: "spiega perché il bootstrap si azzera in uno stato terminale o si mantiene se l'episodio è solo interrotto" },
    ],
  },
  {
    text: "Nella lezione L08 di questo corso viene assegnata una dimostrazione da fare a casa. Individua l'enunciato assegnato, riporta le ipotesi sulle due politiche e la conclusione, quindi spiega il collegamento con le due proprietà GLIE presentate subito dopo. Indica le slide che giustificano la tua ricostruzione.",
    rubric: [
      { criterion: "Consegna individuata e localizzata", points: 3, expected: "individua la consegna «Prove it at home» sul miglioramento della politica epsilon-greedy, con la slide che la riporta" },
      { criterion: "Enunciato", points: 3, expected: "per ogni politica epsilon-greedy pi, la politica epsilon-greedy pi' rispetto a Q^pi è un miglioramento" },
      { criterion: "Conclusione", points: 2, expected: "V^pi' >= V^pi" },
      { criterion: "Distinzione dalle proprietà GLIE", points: 2, expected: "le due proprietà GLIE (ogni coppia stato-azione esplorata infinite volte; la politica converge alla greedy) sono condizioni di convergenza, non l'enunciato da dimostrare" },
    ],
  },
];

const { courses } = await call("/courses");
const course = courses[0];
if (!course) {
  console.error("Nessun corso: prima carica il materiale con scripts/seed.mjs.");
  process.exit(1);
}
const { exams } = await call(`/courses/${course.id}/exams`);
if (exams.some((e) => e.title === EXAM_TITLE)) {
  console.log(`«${EXAM_TITLE}» esiste già nel corso ${course.name}: niente da fare.`);
  process.exit(0);
}
const exam = await call(`/courses/${course.id}/exams`, { method: "POST", body: JSON.stringify({ title: EXAM_TITLE }) });
for (const [i, q] of QUESTIONS.entries()) {
  const r = await call(`/exams/${exam.id}/questions`, { method: "POST", body: JSON.stringify(q) });
  console.log(`Domanda ${"ABC"[i]}: ${r.id}`);
}
console.log(`Esame «${EXAM_TITLE}» creato nel corso ${course.name} (${exam.id}).`);
