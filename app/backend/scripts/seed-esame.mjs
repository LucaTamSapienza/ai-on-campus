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

// Entra come docente con l'account di demo (la password è uguale all'email).
let token = null;
async function login() {
  const res = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(code ? { "x-demo-code": code } : {}) },
    body: JSON.stringify({ email: "teacher@prisma.edu", password: "teacher@prisma.edu" }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`POST /login: ${res.status} ${body?.error?.message ?? ""}`);
  return body.token;
}

async function call(path, init = {}) {
  token ??= await login();
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}`, ...(code ? { "x-demo-code": code } : {}) };
  const res = await fetch(`${API}/api${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${body?.error?.message ?? ""}`);
  return body;
}

const EXAM_TITLE = "Mock exam";

// Tre domande da 10 punti: una che un modello generico risolve senza il corso (A), una con
// un'assunzione nascosta (B), una che dipende da ciò che è specifico del corso (C).
const QUESTIONS = [
  {
    text: "In tabular Q-learning, Q(s,a)=2, alpha=0.5, gamma=0.9. A non-terminal transition gives reward 1 and max_b Q(s',b)=4. Compute the new Q(s,a), show the target and the TD error, and explain why the method is off-policy.",
    rubric: [
      { criterion: "TD target", points: 2, expected: "target = r + gamma * max_b Q(s',b) = 1 + 0.9 * 4 = 4.6" },
      { criterion: "TD error", points: 2, expected: "delta = target - Q(s,a) = 4.6 - 2 = 2.6" },
      { criterion: "New value", points: 3, expected: "Q(s,a) = 2 + 0.5 * 2.6 = 3.3" },
      { criterion: "Off-policy", points: 3, expected: "the target uses the greedy policy (max), distinct from the policy that collects the data (for example epsilon-greedy)" },
    ],
  },
  {
    text: "A transition ends the simulator's episode. Q(s,a)=2, alpha=0.5, gamma=0.9, reward 1; before the reset the table shows max_b Q(s',b)=4. Perform the Q-learning update and justify the target.",
    rubric: [
      { criterion: "Explicit assumption", points: 2, expected: "states whether the end of the episode is a true terminal state or an external interruption (timeout, truncation)" },
      { criterion: "Formula consistent with the assumption", points: 3, expected: "terminal: target = r; truncation: target = r + gamma * max_b Q(s',b)" },
      { criterion: "Consistent result", points: 3, expected: "1.5 if terminal (target 1), or 3.3 if truncation (target 4.6)" },
      { criterion: "Bootstrap", points: 2, expected: "explains why bootstrapping drops to zero in a terminal state or is kept if the episode is only interrupted" },
    ],
  },
  {
    text: "In lesson L08 of this course a proof is assigned as homework. Identify the assigned statement, give the hypotheses on the two policies and the conclusion, then explain how it relates to the two GLIE properties presented right after. Point to the slides that support your reconstruction.",
    rubric: [
      { criterion: "Task identified and located", points: 3, expected: "identifies the “Prove it at home” task on the improvement of the epsilon-greedy policy, with the slide that states it" },
      { criterion: "Statement", points: 3, expected: "for any epsilon-greedy policy pi, the epsilon-greedy policy pi' with respect to Q^pi is an improvement" },
      { criterion: "Conclusion", points: 2, expected: "V^pi' >= V^pi" },
      { criterion: "Distinction from the GLIE properties", points: 2, expected: "the two GLIE properties (every state-action pair explored infinitely often; the policy converges to the greedy one) are convergence conditions, not the statement to prove" },
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
