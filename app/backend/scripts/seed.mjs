#!/usr/bin/env node
// Semina il corso chiamando l'API, la stessa che usa il docente dall'interfaccia.
//
//   node scripts/seed.mjs <cartella-materiale> [opzioni]
//
// Opzioni:
//   --api <url>      indirizzo del Worker (predefinito http://localhost:8787)
//   --limit <N>      solo le prime N fonti in ordine di nome (0 = crea solo il corso)
//   --only L03,L08   solo le fonti il cui nome inizia con uno di questi prefissi
//   --ontologia      carica le fonti senza Cartografo (extract=false) e poi importa
//                    <cartella>/ontologia.json, preparata a parte con un modello più capace
//   --code <codice>  codice demo, se il Worker ha DEMO_CODE (oppure variabile DEMO_CODE)
//
// Senza --ontologia ogni fonte passa dal Cartografo, una alla volta: si aspetta che
// ognuna finisca prima di caricare la successiva.
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const COURSE = { name: "Reinforcement Learning", description: "Corso magistrale: bandit, MDP, programmazione dinamica, TD, Q-learning, approssimazione di funzione, RL basato su modello." };

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.match(/^--(api|limit|only|code)$/));
if (!dir) {
  console.error("Uso: node scripts/seed.mjs <cartella-materiale> [--api url] [--limit N] [--only L03,L08] [--ontologia] [--code codice]");
  process.exit(1);
}
const API = (opt("--api") ?? "http://localhost:8787").replace(/\/$/, "");
const limit = opt("--limit") !== undefined ? Number(opt("--limit")) : Infinity;
const only = opt("--only")?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const ontologyMode = args.includes("--ontologia");
const code = opt("--code") ?? process.env.DEMO_CODE;

async function call(path, init = {}) {
  const headers = { "content-type": "application/json", ...(code ? { "x-demo-code": code } : {}) };
  const res = await fetch(`${API}/api${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${body?.error?.message ?? ""}`);
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Corso: si riusa se esiste già con lo stesso nome.
const { courses } = await call("/courses");
let course = courses.find((c) => c.name === COURSE.name);
if (!course) {
  course = await call("/courses", { method: "POST", body: JSON.stringify(COURSE) });
  console.log(`Corso creato: ${course.name} (${course.id})`);
} else {
  console.log(`Corso esistente: ${course.name} (${course.id})`);
}

const root = resolve(dir);
let files = (await readdir(root)).filter((f) => /\.(md|txt)$/i.test(f)).sort();
if (only?.length) files = files.filter((f) => only.some((p) => f.toLowerCase().startsWith(p)));
files = files.slice(0, limit);

for (const file of files) {
  const title = basename(file).replace(/\.(md|txt)$/i, "");
  const text = await readFile(join(root, file), "utf8");
  const started = Date.now();
  const r = await call(`/courses/${course.id}/sources`, {
    method: "POST",
    body: JSON.stringify({ title, text, kind: "document", extract: !ontologyMode }),
  });
  if (r.duplicate) {
    console.log(`${title}: già presente, salto`);
    continue;
  }
  console.log(`${title}: ${r.passages} passaggi (${r.thin} senza testo estratto)`);
  if (ontologyMode) continue;

  // Si aspetta che il Cartografo finisca questa fonte prima della successiva.
  for (;;) {
    await sleep(3000);
    const { sources } = await call(`/courses/${course.id}/sources`);
    const s = sources.find((x) => x.id === r.sourceId);
    if (s?.status === "done" || s?.status === "error") {
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(`  ${s.status === "done" ? "letta" : "ERRORE"} in ${secs}s: ${s.conceptCount} concetti${s.error ? ` · ${s.error}` : ""}`);
      break;
    }
  }
}

if (ontologyMode) {
  const ontology = JSON.parse(await readFile(join(root, "ontologia.json"), "utf8"));
  const report = await call(`/courses/${course.id}/ontology`, { method: "POST", body: JSON.stringify(ontology) });
  console.log(
    `Ontologia importata: ${report.topics} argomenti, ${report.added} concetti nuovi, ${report.updated} aggiornati, ${report.relations} relazioni, ${report.rejected.length} riferimenti respinti`,
  );
  for (const r of report.rejected.slice(0, 20)) console.log(`  respinto (${r.kind}) ${r.name}: ${r.reason}`);
}

const usage = await call("/usage");
console.log(`Spesa di oggi: ${usage.today.costUsd.toFixed(4)} $ in ${usage.today.calls} chiamate (tetto ${usage.budgetUsd} $)`);
