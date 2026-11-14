# PRISMA architecture

What the system receives, what knowledge it uses, which agents act, what each one may and may not see, which decisions are taken in code and which by a person, and what it returns. Paths are relative to the repository root. The product plan and build notes, in Italian, are in `docs/fase-01-piano.md` and `docs/fase-02…05`.

## Overview

One Cloudflare Worker (`app/backend/src/index.ts`, name `ai-on-campus`):

- `/api/*` → Hono routes (course, sources, ontology, graph, concepts, exam, class, lessons, study plan, usage).
- `/agents/*` → Durable Objects built with the Cloudflare Agents SDK. Clients connect over WebSocket in read-only mode (`shouldConnectionBeReadonly`): they receive the agent's state, they cannot change it, and no agent exposes callable methods to the browser.
- everything else → the Next.js static export (`app/frontend/out`), with security headers from `app/frontend/public/_headers`.

D1 holds all persistent data. Every model call goes through `app/backend/src/llm.ts` to OpenRouter.

```
browser ── /api/* ─────────▶ Hono ──▶ D1
   │                          │
   │                          └─ RPC / enqueue ─▶ Durable Object (one per course / run / plan)
   └── WebSocket /agents/* ──────────────────────▶      │
                                                         └─▶ llm.ts ─▶ OpenRouter
```

## Inputs, knowledge, outputs

| | |
|---|---|
| **Input** | Course material as text or Markdown (upload or seed), a lesson recording (WAV, up to 3 minutes), exam questions with a rubric, the teacher's decisions, the student's days and known lessons/concepts |
| **Knowledge** | The course passages in D1 (one per slide when the material has `## Slide N`), the concept graph with evidence slides, FTS5 index on passages. Nothing outside the course is retrieved |
| **Tools** | No agent has tools. Agents return text or JSON with a strict schema; all reads and writes are done by backend code |
| **Decisions in code** | Which passages each agent receives, whether citations are verified, totals per rubric, verdicts and thresholds, study order, what the student role may see, spending cap |
| **Decisions by a person** | Approving, editing or keeping a rewrite (the only way to create a new question version); correcting or deleting a concept; marking lessons as done; sending a transcript to the graph |
| **Output** | The graph, attack runs with grades and verdicts, rewrite proposals, question versions, class results with lost points explained by lessons and concepts, study plans with sessions and slides |

## Agents and their boundaries

The boundary of each agent is the function that builds its prompt: it receives only what that agent may see, so nothing else can leak into the context. All untrusted text (passages, answers, transcripts) is wrapped in tags that it cannot close (`fence()` removes any closing tag from the body), with an instruction that it is data and not instructions.

| Agent | Where | Receives | Does not receive / cannot do | Returns |
|---|---|---|---|---|
| **Cartographer** | `app/backend/src/cartografo.ts`, `ontology.ts`, `segment.ts`; Durable Object, one per course | Windows of about 6,000 characters of passages of one source, the names of concepts already in the course | Passages of other courses; slides with almost no text (`thin`) are never sent and never count as evidence; cannot write outside its course | JSON (schema): up to 12 concepts per window with definition, kind, evidence passages; relations with type and evidence. Validated in `writeOntology`: evidence must be a passage of this window, relations must resolve, no self-loops |
| **Term extraction** | `esame/agents.ts` `extractTerms` | The question text | Course, rubric | 3–8 English technical terms, used only to search; they do not enter any attacker's context |
| **Outsider** | `esame/agents.ts` `runEsterno` | The question text only (`{question}`) | Course passages, rubric | A free-text answer |
| **Literalist** | `runLetterale` | Question + retrieved passages (max 12, max 14,000 characters) | Rubric | JSON: answer, citations `{passageId, quote}`, `missing`. Code keeps a citation only if the label is one of the received passages and the quote is a substring of that passage (whitespace-normalised); otherwise it goes to `discarded`. No verified citation → `missing = true` |
| **Quibbler** | `runCavillatore` | Question + retrieved passages | Rubric | JSON: `found`, the ambiguous phrase, the assumption, exactly two readings with an answer each, or none. A schema refinement rejects `found = true` with a number of readings other than two |
| **Grader** | `runCorrettore` | Question, rubric, one answer | Which agent or student wrote the answer; passages | Points per criterion with a reason. Code clamps each score to `[0, max]` in half points, rejects a missing criterion and computes the total |
| **Reviewer** | `runRevisore` | Question, rubric, outcomes and grades, verified passages | Cannot change the rubric; cannot save anything; cannot propose a text when the course does not cover the question | JSON: proposed question text and rationale. The coverage mode is decided in code (`courseCoverage`): covered → free rewrite; passages not enough but a candidate ambiguity → rewrite only to make the assumption explicit, without attributing anything to the course; no passages, or passages not enough without ambiguity → the code discards any text and the rationale says the question is not covered. The prompt forbids "fair", "valid", "AI-proof", "cheat-proof" |
| **Attack coordinator** | `esame/attacco.ts`; Durable Object, one per run | Run id | Cannot write question versions | Runs retrieval, the three attacks in parallel, the grades, the Reviewer; idempotent steps; writes to D1; streams state. Never writes `question_versions` |
| **Student** (×8) | `classe/classe.ts` `runStudente`; coordinator `Classe`, one per run | Synthetic profile + question + only the retrieved passages whose source is one of the lessons the profile attended (`run.passages.filter(p => attended.has(p.sourceId))`) | Passages of lessons not attended, rubric, other students' answers | A free-text answer; graded by the same Grader |
| **Planner** | `studio/pianificatore.ts`; Durable Object, one per plan | One session at a time: concepts in the order computed by `studio/plan.ts`, with their "comes after" links and up to 24 evidence passages | Any table outside the allow-list; any free text from the student; any exam question | JSON: `why` and `look` (passage labels + notes). Labels not among the received passages are discarded |
| **Transcriber** | `lezioni/routes.ts` | WAV audio, 16 kHz mono, at most 3 minutes and 7 MB, duration read from the header | No course data: it receives only the audio and its instruction; the audio is not stored | Transcript returned to the teacher, who reviews it and sends it to the Cartographer as a `transcript` source |

### Boundaries enforced in code

1. **Only the teacher creates a question version.** `POST /api/questions/:id/decision` (`app/backend/src/esame/routes.ts`) is the only code path that inserts into `question_versions`. It needs `reviewId` and `expectedVersionId`; a stale version answers 409 `version_changed`. The rubric is copied from the previous version, so before and after are graded on the same criteria.
2. **No rubric, no attack.** `POST /api/exams/:id/questions` without a rubric, or with an empty one, answers 422 `rubric_required`; the attack and class routes repeat the same check on the current version.
3. **Isolated contexts.** Each agent function receives a typed input object with only its fields (see the table). The Outsider's input type is `{ question: string }`.
4. **Verified citations and computed verdicts.** Citations are checked as substrings; totals are recomputed; verdicts and the 70% threshold live in `computeVerdicts` (`app/backend/src/esame/data.ts`). The model writes only answers, reasons, the rewrite and its rationale. "Insufficient evidence in the retrieved passages" is raised from the saved data when retrieval returns no passages, when the Literalist has no verified citation, or when it declares `missing: true`; in those cases the Reviewer gets no licence to attribute content to the course (see the Reviewer row).
5. **Student role read-only on the server.** `studentGuard` (`app/backend/src/classe/role.ts`): with `x-role: studente` every non-GET request answers 403 except `POST /api/courses/:id/study-plans`; reads of exams, questions, runs, class runs, students, proposals and usage answer 403. WebSocket: only the Cartographer and the Planner are reachable with `?role=studente`. The role is set by a simulated selector (see "Security").
6. **The Planner cannot read exam or class data.** Every query of the study module goes through `studioQuery` (`app/backend/src/studio/plan.ts`), which parses the table names after `FROM`, `JOIN`, `INTO`, `UPDATE` and throws for any table outside `courses, sources, passages, topics, concepts, concept_passages, relations, lessons_done, study_plans, study_sessions`. The study-plan request body is validated by a `zod` schema with only `days` (1–60) and identifiers, filtered on the course's own ids; unknown fields are dropped. (The model-call log in `model_calls` is written by `llm.ts` for every agent and is outside this check.)
7. **Graph writes are validated.** The Cartographer and the ontology import share `writeOntology` (`app/backend/src/ontology.ts`): allowed evidence passages are an explicit set, a concept without evidence is discarded, relation types are checked one by one, and the import returns a report of rejected references.

## Retrieval

`app/backend/src/esame/retrieval.ts`, no embeddings:

1. Terms from the model plus technical tokens of the question (`Q-learning`, `GLIE`, `L08`).
2. Concepts whose name appears in the question or terms (up to 6), and their first-degree neighbours in the graph (up to 6).
3. FTS5 `MATCH` with quoted phrases and single words, ranked with BM25, slides without text excluded.
4. Merge: first the definition slide of each named concept, then full-text hits, then other evidence of named concepts, then neighbours. At most 12 passages and 14,000 characters.
5. If the question names a lesson (`L08`), retrieval stays inside that lesson.

Every passage stores why it was picked (`term`, `concept`, `neighbour` with the relation), in `run_passages.reason`; the touched concepts are saved per question version. The interface shows this path next to the verdicts.

## Data model

All tables are created by `app/backend/migrations/` (the only source of the schema). Identifiers are generated by the backend.

| Migration | Tables | Purpose |
|---|---|---|
| `0001_ontologia.sql` | `courses`, `sources` (with `content_hash`, `windows_done`, status), `passages` (`locator`, `thin`), `topics`, `concepts` (unique slug per course), `concept_passages` (role), `relations` (type, note, evidence passage), `model_calls` | Course graph with provenance; cost log |
| `0002_esame.sql` | `exams`, `questions`, `question_versions` (text, rubric JSON, origin), `attack_runs`, `run_passages`, `attacks`, `grades` (one per attack and reading), `reviews` (verdicts, proposed text), `decisions`, `question_version_concepts`, virtual `passages_fts` with triggers | Triple attack and versioning |
| `0003_classe.sql` | `students`, `student_sources`, `class_runs`, `class_run_passages`, `class_answers` | Simulated class |
| `0004_lezioni.sql` | `lessons_done` | Lessons marked as done |
| `0005_studio.sql` | `study_plans`, `study_sessions` | Study plans |

Relation types, from A to B: `prerequisito` (A is needed to understand B), `parte_di` (A is a component of B), `generalizza` (A is the general case of B), `usa` (A relies on B), `contrasta` (A and B are alternatives). Concept kinds: `concetto`, `metodo`, `risultato`, `esempio`. These enum values are stored in D1 as Italian identifiers.

## Flows

**Upload a lesson.** `POST /api/courses/:id/sources` → segmentation in code (slides, headings or paragraph blocks; repeated footer lines removed; `REDACT_TERMS` removed) → passages in D1 → the course's Cartographer reads window by window, writes after each window (upsert) and broadcasts progress → topic assignment → source `done` or `error`. The same content uploaded twice returns the existing source (`duplicate: true`).

**Triple attack.** `POST /api/questions/:id/attack` writes the run and three pending attacks in D1, answers 202 `{runId}` (409 if a run is already active for that question) and hands over to the `Attacco` Durable Object named after the run → retrieval → Outsider, Literalist, Quibbler in parallel, each streaming → Grader per answer (two for the Quibbler when it finds two readings) → Reviewer when all three attacks are graded or failed → verdicts computed in code → `GET /api/runs/:id`. The teacher then calls the decision route; a new version can be attacked again and versions are compared in "Before and after".

**Class.** `POST /api/questions/:id/class` → same retrieval → for each synthetic student, the passages of attended lessons only → answer → Grader → summary computed in code (grade bands, average per criterion, lessons and concepts that separate grades by at least 10 percentage points).

**Study plan.** `POST /api/courses/:id/study-plans` → `buildPlan` in code: scope (lessons marked done, or the whole course), known concepts, a topological order over `prerequisito`, `parte_di`, `usa` with ties broken by where the course introduces a concept, cycles broken and counted, `min(days, 12)` sessions → the Planner writes `why` and `look` for each session.

## Security

- **Key stays in the Worker.** `OPENROUTER_API_KEY` only in `app/backend/.dev.vars` (gitignored) or `wrangler secret`. The browser calls only `/api`.
- **Spending cap.** `llm.ts` reserves the maximum cost of a call with one atomic `INSERT … SELECT … WHERE spent + estimate <= cap` before calling, then settles with the real cost from OpenRouter (or 0 on failure). `DAILY_BUDGET_USD` defaults to 1.50. 90 s timeout and one retry on network errors, 429, 5xx, empty response or invalid JSON.
- **Demo code.** If `DEMO_CODE` is set, every `/api` route except `/api/health` requires `x-demo-code`, and agent WebSockets require `?code=`. Compared in constant time. It protects a public URL; it is not a login.
- **Origin.** Agent WebSockets accept only the Worker's own origin (and `localhost` when running locally); CORS is open only to `localhost` in local development. Hono `secureHeaders` on the API; CSP, `X-Frame-Options: DENY` and a permissions policy that allows the microphone only for the same origin on static files.
- **Input limits.** Text and Markdown only, 300,000 characters per source, 40 sources per course, body size limits, every body validated with `zod`; audio 3 minutes, 7 MB, WAV only.
- **SQL** only with bound parameters.
- **No HTML from data.** Model output and course text are rendered as text; no `dangerouslySetInnerHTML` in the frontend.
- **Simulated role.** The student/teacher role is a header set by the interface's selector. The server enforces what each role can do, but it cannot know who is calling: there is no authentication. In production this would be the university's single sign-on.
- **Material and names.** The course slides are not in the repository; the teacher's name is removed at ingestion through `REDACT_TERMS` and never stored in D1.
