"use client";

// I tre attacchi. Desktop: tre colonne affiancate. Telefono: prima tre righe di riepilogo sempre
// visibili (il confronto non si perde), poi ogni agente si apre con testo e voto.
import { useState } from "react";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import type { Attack, AttackAgent, AttaccoState, CavillatoreFinding, LetteraleFinding, RunDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AGENT_META, fmt, GradeView, PassageRef } from "./shared";

type Props = { run: RunDetail; live: AttaccoState | null };

export function RunBoard({ run, live }: Props) {
  const passages = run.retrieval?.passages.length ?? 0;
  return (
    <section aria-label="The three attacks" className="flex flex-col gap-4">
      {/* Telefono */}
      <div className="flex flex-col gap-3 lg:hidden">
        <SummaryRows run={run} live={live} />
        {run.attacks.map((a) => (
          <MobileAgent key={a.agent} attack={a} run={run} live={live} passages={passages} />
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {run.attacks.map((a) => (
          <div key={a.agent} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <AgentHeader attack={a} live={live} passages={passages} />
            <AgentBody attack={a} run={run} live={live} />
          </div>
        ))}
      </div>
    </section>
  );
}

function liveOf(live: AttaccoState | null, agent: AttackAgent) {
  return live?.agents[agent] ?? null;
}

// Lo stato mostrato: «finito» e «errore» solo da D1 (lì ci sono risposta e prove); dal vivo si
// sa soltanto chi sta lavorando. Finché D1 non ha il risultato, l'agente resta «al lavoro».
function statusOf(attack: Attack, live: AttaccoState | null) {
  if ((attack.status === "done" && attack.finding) || attack.status === "error") return attack.status;
  const l = liveOf(live, attack.agent)?.status;
  return l && l !== "pending" ? "running" : attack.status === "done" ? "running" : attack.status;
}

function outcomeText(attack: Attack, live: AttaccoState | null): string {
  const status = statusOf(attack, live);
  if (status === "error") return "Did not finish";
  if (status !== "done") return status === "running" ? "Answering" : "Waiting";
  const graded = attack.grades.filter((g) => g.total !== null);
  if (attack.agent === "cavillatore") {
    const f = attack.finding as CavillatoreFinding | null;
    if (!f?.found) return "No second reading";
    return graded.length ? `Two readings: ${graded.map((g) => fmt(g.total!)).join(" and ")} out of ${fmt(graded[0].max)}` : "Two readings, being graded";
  }
  const g = attack.grades[0];
  if (!g) return "Being graded";
  if (g.total === null) return "Grading failed";
  return `${fmt(g.total)} out of ${fmt(g.max)}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-accent" aria-label="Working" />;
  if (status === "error") return <AlertCircle className="size-4 text-destructive" aria-label="Error" />;
  return null;
}

function SummaryRows({ run, live }: Props) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-card" aria-label="Outcome summary">
      {run.attacks.map((a) => (
        <li key={a.agent} className="flex min-h-12 items-center justify-between gap-3 px-3">
          <span className="flex items-center gap-2 text-base font-medium">
            {AGENT_META[a.agent].name}
            <StatusIcon status={statusOf(a, live)} />
          </span>
          <span className="text-right text-sm tabular-nums text-muted-foreground">{outcomeText(a, live)}</span>
        </li>
      ))}
    </ul>
  );
}

function MobileAgent({ attack, run, live, passages }: { attack: Attack; run: RunDetail; live: AttaccoState | null; passages: number }) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[attack.agent];
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex flex-col">
          <span className="text-base font-semibold">{meta.name}</span>
          <span className="text-sm text-muted-foreground">{meta.role}</span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t px-3 py-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Has access to: </span>
            {meta.holds(passages)}
          </p>
          <AgentBody attack={attack} run={run} live={live} />
        </div>
      )}
    </div>
  );
}

function AgentHeader({ attack, live, passages }: { attack: Attack; live: AttaccoState | null; passages: number }) {
  const meta = AGENT_META[attack.agent];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{meta.name}</h3>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <StatusIcon status={statusOf(attack, live)} />
          {outcomeText(attack, live)}
        </span>
      </div>
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Has access to: </span>
        {meta.holds(passages)}
      </p>
      <p className="font-mono text-xs text-muted-foreground">{attack.model}</p>
    </div>
  );
}

function AgentBody({ attack, run, live }: { attack: Attack; run: RunDetail; live: AttaccoState | null }) {
  const status = statusOf(attack, live);
  if (status === "error") return <p className="text-sm text-destructive">{attack.error ?? liveOf(live, attack.agent)?.note ?? "Error"}</p>;
  if (status !== "done") {
    const text = liveOf(live, attack.agent)?.text ?? "";
    return text ? (
      <p className="text-base whitespace-pre-wrap">
        {text}
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" aria-hidden />
      </p>
    ) : (
      <div className="flex flex-col gap-2" aria-label="Waiting for the answer">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (attack.agent === "cavillatore") return <CavillatoreBody attack={attack} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base whitespace-pre-wrap">{attack.answer}</p>
      {attack.agent === "letterale" && <Citations finding={attack.finding as LetteraleFinding} run={run} />}
      <Grades attack={attack} />
    </div>
  );
}

function Grades({ attack }: { attack: Attack }) {
  if (attack.grades.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> The Grader is grading
      </div>
    );
  }
  return <GradeView grade={attack.grades[0]} />;
}

function Citations({ finding, run }: { finding: LetteraleFinding; run: RunDetail }) {
  const byId = new Map(run.retrieval?.passages.map((p) => [p.id, p]) ?? []);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {finding.citations.length ? `Verified citations (${finding.citations.length})` : "No verified citations"}
      </p>
      {finding.citations.map((c, i) => {
        const p = byId.get(c.passageId);
        return p ? <PassageRef key={i} passage={p} quote={c.quote} /> : null;
      })}
      {finding.discarded.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {finding.discarded.length === 1 ? "1 citation discarded" : `${finding.discarded.length} citations discarded`}: the sentence is not in the passages received.
        </p>
      )}
    </div>
  );
}

function CavillatoreBody({ attack }: { attack: Attack }) {
  const f = attack.finding as CavillatoreFinding;
  if (!f.found) {
    return <p className="text-base text-muted-foreground">No defensible second reading found. Nothing to fix.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Ambiguous sentence</p>
        <p className="text-base font-medium">“{f.phrase}”</p>
        <p className="text-sm text-muted-foreground">{f.assumption}</p>
      </div>
      {f.readings.map((r, i) => {
        const grade = attack.grades.find((g) => g.readingIndex === i);
        return (
          <div key={i} className="flex flex-col gap-2 border-t pt-3">
            <p className="text-sm font-semibold">Reading {i + 1}</p>
            <p className="text-sm text-muted-foreground">{r.interpretation}</p>
            <p className="text-base whitespace-pre-wrap">{r.answer}</p>
            {grade ? (
              <GradeView grade={grade} label={`Score for reading ${i + 1}`} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> The Grader is grading
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
