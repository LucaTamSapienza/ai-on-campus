#!/usr/bin/env node
// Semina la classe simulata: otto studenti sintetici, con nomi di fantasia, media inventata,
// modo di studiare e lezioni seguite. Nessun dato reale. Chiama l'API come il resto della semina.
//
//   node scripts/seed-classe.mjs [--api http://localhost:8787] [--code <codice demo>]
//
// Usa il primo corso. Rifarla aggiorna gli stessi profili (stesso nome), non crea doppioni.

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

const all = ["L00", "L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08", "L09", "L10", "L11", "L12"];
const except = (...skip) => all.filter((l) => !skip.includes(l));

// Profili scelti per coprire i casi che il docente vuole vedere: chi ha seguito tutto, chi ha
// saltato la lezione su Q-learning e SARSA (L08), chi è arrivato a metà corso, chi ha saltato gli MDP.
const STUDENTS = [
  { name: "Aurora Venti", priorGrade: 29, style: "Segue ogni lezione, rifà le dimostrazioni e controlla i calcoli.", lessons: all },
  { name: "Bruno Castelfidardo", priorGrade: 25, style: "Studia dalle slide la settimana prima, preciso sulle formule ma sbrigativo sulle spiegazioni.", lessons: except("L06", "L10") },
  { name: "Clelia Marangoni", priorGrade: 27, style: "Ragiona per intuizione, spiega bene i concetti ma a volte salta i passaggi di calcolo.", lessons: except("L08") },
  { name: "Dario Pellicano", priorGrade: 22, style: "Ha seguito la prima metà del corso, poi ha smesso di frequentare.", lessons: ["L00", "L01", "L02", "L03", "L04", "L05", "L06"] },
  { name: "Elsa Brunacci", priorGrade: 26, style: "Si è iscritta tardi: ha seguito la seconda metà, recupera il resto dalle definizioni.", lessons: ["L07", "L08", "L09", "L10", "L11", "L12"] },
  { name: "Fabio Lanterna", priorGrade: 20, style: "Studia all'ultimo, ricorda le parole chiave ma confonde i dettagli. Risposte brevi.", lessons: ["L00", "L03", "L08"] },
  { name: "Giada Orsenigo", priorGrade: 28, style: "Molto ordinata, scrive risposte strutturate; ha saltato le lezioni sugli MDP per malattia.", lessons: except("L03", "L04") },
  { name: "Ivo Settembrini", priorGrade: 24, style: "Segue con attenzione le lezioni sui metodi tabulari, meno quelle sull'approssimazione.", lessons: ["L00", "L01", "L03", "L04", "L05", "L08", "L09"] },
];

const { courses } = await call("/courses");
const course = courses[0];
if (!course) {
  console.error("Nessun corso: lancia prima scripts/seed.mjs.");
  process.exit(1);
}
for (const s of STUDENTS) {
  const r = await call(`/courses/${course.id}/students`, { method: "POST", body: JSON.stringify(s) });
  console.log(`${s.name}: ${r.lessons.length} lezioni`);
}
