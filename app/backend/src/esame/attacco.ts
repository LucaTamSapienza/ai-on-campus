// Coordinatore del triplo attacco: un Durable Object per esecuzione (nome = runId).
// Lo stato vero sta in D1; questo oggetto esegue i passi, idempotenti, e trasmette lo stato dal vivo
// ai client in sola lettura. Il lavoro parte dalla coda durevole dell'agente, non da una Promise
// lasciata dopo la risposta HTTP: se l'oggetto si riavvia, la coda lo riprende da dove D1 dice.
import { Agent } from "agents";
import {
  extractTerms,
  partialFields,
  runCavillatore,
  runCorrettore,
  runEsterno,
  runLetterale,
  runRevisore,
  type CavillatoreFinding,
  type ContextPassage,
  type LetteraleFinding,
} from "./agents";
import { AGENTS, answersToGrade, computeVerdicts, loadRun, type AttackAgent, type RunDetail } from "./data";
import { clipPassage, retrievePassages, technicalTokens } from "./retrieval";

export type LiveStatus = "pending" | "running" | "done" | "error";
export type LiveAgent = { status: LiveStatus; text: string; note: string | null };
export type AttaccoState = {
  runId: string | null;
  status: "idle" | "running" | "done" | "error";
  step: "recupero" | "attacco" | "revisione" | "fatto" | null;
  agents: Record<AttackAgent | "recupero" | "correttore" | "revisore", LiveAgent>;
  // Cresce a ogni scrittura in D1: il client rilegge GET /api/runs/:id quando cambia.
  version: number;
};

const idle = (): LiveAgent => ({ status: "pending", text: "", note: null });
const INITIAL: AttaccoState = {
  runId: null,
  status: "idle",
  step: null,
  agents: { recupero: idle(), esterno: idle(), letterale: idle(), cavillatore: idle(), correttore: idle(), revisore: idle() },
  version: 0,
};

// Tetto dell'intera esecuzione: oltre, si chiude con «Analisi incompleta».
const RUN_DEADLINE_MS = 300_000;
// Il testo dal vivo si trasmette a blocchi, non a ogni token.
const FLUSH_MS = 400;

class Expired extends Error {}

export class Attacco extends Agent<Env, AttaccoState> {
  initialState: AttaccoState = INITIAL;
  private pendingText = new Map<string, string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private deadline = 0;

  // I client guardano soltanto: lo stato lo scrive solo il server.
  shouldConnectionBeReadonly() {
    return true;
  }

  // Chiamato dal Worker via RPC dopo aver scritto l'esecuzione in D1. La coda è durevole:
  // il lavoro sopravvive alla fine della richiesta e a un riavvio dell'oggetto.
  async start(runId: string) {
    this.setState({ ...INITIAL, runId, status: "running", step: "recupero" });
    await this.queue("execute", { runId }, { id: runId });
    // Rete di sicurezza: se per qualunque motivo l'esecuzione resta aperta, la chiude.
    await this.schedule(RUN_DEADLINE_MS / 1000 + 120, "expire", { runId });
  }

  async execute(payload: { runId: string }) {
    await this.keepAliveWhile(async () => {
      this.deadline = Date.now() + RUN_DEADLINE_MS;
      try {
        await this.pipeline(payload.runId);
      } catch (err) {
        await this.close(payload.runId, err instanceof Expired ? "Tempo scaduto" : errMessage(err));
      }
    });
  }

  async expire(payload: { runId: string }) {
    const row = await this.env.DB.prepare("SELECT status FROM attack_runs WHERE id = ?").bind(payload.runId).first<{ status: string }>();
    if (row?.status === "running") await this.close(payload.runId, "Tempo scaduto");
  }

  private live(agent: keyof AttaccoState["agents"], patch: Partial<LiveAgent>) {
    // Un blocco di testo ancora in coda non deve sovrascrivere lo stato finale.
    if (patch.status === "done" || patch.status === "error") this.pendingText.delete(agent);
    this.setState({ ...this.state, agents: { ...this.state.agents, [agent]: { ...this.state.agents[agent], ...patch } } });
  }

  private bump(patch: Partial<AttaccoState> = {}) {
    this.setState({ ...this.state, ...patch, version: this.state.version + 1 });
  }

  // Testo in arrivo: si accumula e si trasmette ogni FLUSH_MS.
  private streamText(agent: keyof AttaccoState["agents"], text: string) {
    this.pendingText.set(agent, text);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const agents = { ...this.state.agents };
      for (const [k, t] of this.pendingText) agents[k as keyof AttaccoState["agents"]] = { ...agents[k as keyof AttaccoState["agents"]], text: t };
      this.pendingText.clear();
      this.setState({ ...this.state, agents });
    }, FLUSH_MS);
  }

  private checkDeadline() {
    if (Date.now() > this.deadline) throw new Expired();
  }

  private async pipeline(runId: string) {
    const db = this.env.DB;
    let run = await loadRun(db, runId);
    if (!run || run.status !== "running") return;
    const ref = `run:${runId}`;

    // 1. Recupero (una volta sola: se c'è già in D1 si riusa).
    if (!run.retrieval) {
      this.bump({ step: "recupero" });
      this.live("recupero", { status: "running", note: "Estrae i termini tecnici" });
      const courseId = (await db.prepare("SELECT course_id FROM questions WHERE id = ?").bind(run.questionId).first<{ course_id: string }>())!.course_id;
      let terms: string[];
      try {
        terms = await extractTerms(this.env, run.version.text, ref);
      } catch {
        // Senza i termini del modello si cerca con i token tecnici della domanda: lo si dice.
        terms = technicalTokens(run.version.text);
        this.live("recupero", { note: "Termini dal testo della domanda (estrazione non riuscita)" });
      }
      this.checkDeadline();
      const found = await retrievePassages(db, courseId, run.version.text, terms);
      await db.batch([
        db.prepare("DELETE FROM run_passages WHERE run_id = ?").bind(runId),
        ...found.passages.map((p, i) =>
          db.prepare("INSERT INTO run_passages (run_id, passage_id, rank, reason) VALUES (?, ?, ?, ?)").bind(runId, p.id, i + 1, JSON.stringify(p.reasons)),
        ),
        ...found.concepts.map((c) =>
          db.prepare("INSERT OR IGNORE INTO question_version_concepts (question_version_id, concept_id) VALUES (?, ?)").bind(run!.version.id, c.id),
        ),
        db.prepare("UPDATE attack_runs SET retrieval = ? WHERE id = ?").bind(JSON.stringify({ terms, concepts: found.concepts }), runId),
      ]);
      run = (await loadRun(db, runId))!;
      this.live("recupero", {
        status: "done",
        note: `${run.retrieval!.passages.length} passaggi, ${found.concepts.length} concetti, ${terms.length} termini`,
      });
      this.bump();
    } else {
      this.live("recupero", { status: "done", note: `${run.retrieval.passages.length} passaggi` });
    }

    // 2. I tre attaccanti in parallelo; ognuno, appena finisce, passa le sue risposte al Correttore.
    this.bump({ step: "attacco" });
    const passages: ContextPassage[] = run.retrieval!.passages.map((p, i) => ({
      id: p.id,
      label: `P${i + 1}`,
      locator: p.locator,
      sourceTitle: p.sourceTitle,
      text: clipPassage(p.text),
    }));
    const snapshot = run;
    await Promise.all(AGENTS.map((agent) => this.chain(snapshot, agent, passages)));
    this.checkDeadline();

    // 3. Il Revisore, quando i tre attacchi sono terminali e ogni risposta ha un voto o un errore.
    run = (await loadRun(db, runId))!;
    if (!run.review) {
      this.bump({ step: "revisione" });
      await this.review(run, passages);
    }

    await db.prepare("UPDATE attack_runs SET status = 'done', finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'").bind(runId).run();
    this.bump({ status: "done", step: "fatto" });
  }

  // Un attaccante e poi le correzioni delle sue risposte. Gli errori restano dentro la catena.
  private async chain(run: RunDetail, agent: AttackAgent, passages: ContextPassage[]) {
    const db = this.env.DB;
    const ref = `run:${run.id}`;
    let attack = run.attacks.find((a) => a.agent === agent)!;
    const question = run.version.text;

    if (attack.status !== "done" && attack.status !== "error") {
      this.live(agent, { status: "running", text: "", note: null });
      await db.prepare("UPDATE attacks SET status = 'running' WHERE id = ?").bind(attack.id).run();
      try {
        let answer: string;
        let finding: unknown;
        if (agent === "esterno") {
          // Solo la domanda.
          finding = await runEsterno(this.env, { question }, ref, (t) => this.streamText(agent, t));
          answer = (finding as { answer: string }).answer;
        } else if (agent === "letterale") {
          // Domanda e passaggi recuperati, niente griglia.
          const f: LetteraleFinding = await runLetterale(this.env, { question, passages }, ref, (t) =>
            this.streamText(agent, partialFields(t, ["answer"])),
          );
          finding = f;
          answer = f.answer;
        } else {
          // Domanda e passaggi recuperati, niente griglia.
          const f: CavillatoreFinding = await runCavillatore(this.env, { question, passages }, ref, (t) =>
            this.streamText(agent, partialFields(t, ["phrase", "assumption", "interpretation", "answer"])),
          );
          finding = f;
          answer = f.found ? f.readings.map((r) => r.answer).join("\n\n") : "";
        }
        await db
          .prepare("UPDATE attacks SET status = 'done', answer = ?, finding = ?, error = NULL, finished_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(answer, JSON.stringify(finding), attack.id)
          .run();
        this.live(agent, { status: "done", text: answer, note: null });
      } catch (err) {
        await db
          .prepare("UPDATE attacks SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(errMessage(err), attack.id)
          .run();
        this.live(agent, { status: "error", note: errMessage(err) });
      }
      this.bump();
      attack = (await loadRun(db, run.id))!.attacks.find((a) => a.agent === agent)!;
    }
    if (attack.status !== "done") return;

    // Correzioni: una riga per risposta, saltate quelle che esistono già.
    const answers = answersToGrade(agent, attack.finding, attack.answer);
    for (const [i, answer] of answers.entries()) {
      if (attack.grades.some((g) => g.readingIndex === i)) continue;
      this.live("correttore", { status: "running", note: `Corregge ${label(agent, i, answers.length)}` });
      try {
        const g = await runCorrettore(this.env, { question, rubric: run.version.rubric, answer }, ref);
        await db
          .prepare("INSERT OR IGNORE INTO grades (id, attack_id, reading_index, total, max, per_criterion) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), attack.id, i, g.total, g.max, JSON.stringify(g.perCriterion))
          .run();
      } catch (err) {
        await db
          .prepare("INSERT OR IGNORE INTO grades (id, attack_id, reading_index, total, max, error) VALUES (?, ?, ?, NULL, ?, ?)")
          .bind(crypto.randomUUID(), attack.id, i, run.version.maxPoints, errMessage(err))
          .run();
      }
      this.bump();
    }
    this.live("correttore", { note: `Ha corretto ${label(agent, 0, 1)}` });
  }

  private async review(run: RunDetail, passages: ContextPassage[]) {
    const db = this.env.DB;
    this.live("correttore", { status: "done", note: null });
    this.live("revisore", { status: "running", text: "", note: "Compone la scheda" });
    const verdicts = computeVerdicts(run);
    const letterale = run.attacks.find((a) => a.agent === "letterale")?.finding as LetteraleFinding | null | undefined;
    const verifiedIds = new Set(letterale?.citations?.map((c) => c.passageId) ?? []);
    const verified = passages.filter((p) => verifiedIds.has(p.id));

    const findings = [
      `Verdetti calcolati: ${verdicts.map((v) => `${v.title} (${v.detail})`).join(" | ")}`,
      ...run.attacks.map((a) => {
        const marks = a.grades.map((g) => (g.total !== null ? `${g.total}/${g.max}` : "voto non riuscito")).join(", ");
        const body = a.status === "done" ? (a.answer || "(nessuna lettura alternativa trovata)").slice(0, 1200) : `non completato: ${a.error ?? ""}`;
        const extra = a.agent === "cavillatore" && (a.finding as CavillatoreFinding | null)?.found
          ? `\nFrase ambigua: ${(a.finding as CavillatoreFinding).phrase}\nAssunzione: ${(a.finding as CavillatoreFinding).assumption}`
          : "";
        return `## ${a.agent} (voti: ${marks || "nessuno"})${extra}\n${body}`;
      }),
    ].join("\n\n");

    let proposedText: string | null = null;
    let rationale: string | null = null;
    let error: string | null = null;
    try {
      const out = await runRevisore(
        this.env,
        { question: run.version.text, rubric: run.version.rubric, findings, verifiedPassages: verified },
        `run:${run.id}`,
        (t) => this.streamText("revisore", partialFields(t, ["proposedText", "rationale"])),
      );
      proposedText = out.proposedText || null;
      rationale = out.rationale || null;
      this.live("revisore", { status: "done", note: null });
    } catch (err) {
      error = errMessage(err);
      this.live("revisore", { status: "error", note: error });
    }
    await db
      .prepare("INSERT OR IGNORE INTO reviews (id, run_id, verdicts, proposed_text, rationale, error) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), run.id, JSON.stringify(verdicts), proposedText, rationale, error)
      .run();
  }

  // Chiusura per errore o tempo scaduto: gli attacchi aperti diventano errori, la scheda dice
  // «Analisi incompleta» con chi non ha finito.
  private async close(runId: string, reason: string) {
    const db = this.env.DB;
    await db
      .prepare("UPDATE attacks SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE run_id = ? AND status IN ('pending', 'running')")
      .bind(reason, runId)
      .run();
    const run = await loadRun(db, runId);
    if (run && !run.review) {
      await db
        .prepare("INSERT OR IGNORE INTO reviews (id, run_id, verdicts, error) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), runId, JSON.stringify(computeVerdicts(run)), reason)
        .run();
    }
    await db
      .prepare("UPDATE attack_runs SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'")
      .bind(reason, runId)
      .run();
    this.bump({ status: "error", step: "fatto" });
  }
}

function label(agent: AttackAgent, i: number, n: number) {
  const name = { esterno: "l'Esterno", letterale: "il Letterale", cavillatore: "il Cavillatore" }[agent];
  return n > 1 ? `${name}, lettura ${i + 1}` : name;
}

function errMessage(err: unknown) {
  return (err instanceof Error ? err.message : "Errore sconosciuto").slice(0, 300);
}
