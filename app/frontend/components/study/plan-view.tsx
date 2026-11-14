"use client";

// Il piano: chi ha fatto cosa (ordine calcolato dal grafo, poi il Pianificatore sessione per
// sessione), le sessioni con i concetti in ordine, il perché e le slide da guardare.
import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import type { PianificatoreState, StudySession } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceRef } from "@/components/source-ref";
import { usePlan } from "./use-plan";

export function PlanView({ planId, onNew }: { planId: string; onNew: () => void }) {
  const { plan, live, error } = usePlan(planId);

  if (error && !plan) return <p className="text-base text-destructive">{error}</p>;
  if (!plan) return <Skeleton className="h-96 w-full" />;
  const running = plan.status === "running";
  const written = plan.sessions.filter((s) => s.status === "done" || s.status === "error").length;
  const { stats } = plan;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-base text-muted-foreground">
          {stats.toStudy} concepts in {plan.sessions.length} {plan.sessions.length === 1 ? "session" : "sessions"} over {plan.days}{" "}
          {plan.days === 1 ? "day" : "days"} · {stats.known} already known ·{" "}
          {plan.scope === "svolte" ? "lessons taught only" : "the whole course"}
        </p>
        <Button variant="outline" onClick={onNew} disabled={running}>
          New plan
        </Button>
      </div>

      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2" aria-label="Who works on the plan">
        <Step
          state="done"
          label="Order from the graph"
          detail={`${stats.edges} links respected${stats.cyclesBroken ? `, ${stats.cyclesBroken} ${stats.cyclesBroken === 1 ? "cycle broken" : "cycles broken"}` : ""}`}
        />
        <Step
          state={running ? "running" : plan.status === "error" ? "error" : "done"}
          label="Planner"
          detail={running ? `Writing: ${written} of ${plan.sessions.length} sessions` : plan.status === "error" ? (plan.error ?? "Stopped") : "Sessions explained"}
        />
      </ol>

      <ol className="flex flex-col gap-4" aria-label="Study sessions">
        {plan.sessions.map((s) => (
          <SessionCard key={s.id} session={s} live={live} />
        ))}
      </ol>
    </div>
  );
}

function Step({ state, label, detail }: { state: "running" | "done" | "error"; label: string; detail: string }) {
  return (
    <li className={cn("flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-colors duration-150", state === "running" && "border-accent")}>
      <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
        {state === "running" ? (
          <Loader2 className="size-4 animate-spin text-accent" />
        ) : state === "done" ? (
          <Check className="size-4 text-success" />
        ) : (
          <AlertCircle className="size-4 text-destructive" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {detail}
        </span>
      </span>
    </li>
  );
}

function SessionCard({ session, live }: { session: StudySession; live: PianificatoreState | null }) {
  const [showOrder, setShowOrder] = useState(false);
  const liveText = live?.sessions[session.id]?.text ?? "";
  const writing = session.status === "running" || (session.status === "pending" && live?.sessions[session.id]?.status === "running");
  const why = session.why ?? (writing ? liveText : "");
  const withoutEvidence = session.concepts.filter((c) => c.evidence === 0);

  return (
    <li className={cn("flex flex-col gap-4 rounded-lg border bg-card p-4 transition-colors duration-150 lg:p-6", writing && "border-accent")}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Day {session.day} · session {session.ordinal}
        </h2>
        <span className="shrink-0 text-sm text-muted-foreground">{session.concepts.length} concepts</span>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Concepts in study order">
        {session.concepts.map((c, i) => (
          <li
            key={c.id}
            className={cn(
              "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm",
              c.evidence === 0 && "border border-dashed border-muted-foreground bg-card",
            )}
          >
            <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 truncate">{c.name}</span>
            {c.evidence === 0 && <span className="shrink-0 text-xs text-muted-foreground">no evidence</span>}
          </li>
        ))}
      </ol>
      {withoutEvidence.length > 0 && (
        <p className="text-sm text-muted-foreground">
          No evidence in the course: {withoutEvidence.map((c) => c.name).join(", ")}. The materials have no slides to base them on.
        </p>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">Why this order</p>
        {session.status === "error" ? (
          <p className="text-base text-destructive">The Planner did not write this session. {session.error}</p>
        ) : why ? (
          <p className="text-base whitespace-pre-line" aria-live={writing ? "polite" : undefined}>
            {why}
            {writing && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" aria-hidden />}
          </p>
        ) : (
          <div className="flex flex-col gap-2" aria-label={writing ? "The Planner is writing" : "Waiting for the Planner"}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowOrder((o) => !o)}
          aria-expanded={showOrder}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Order in the graph
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-150", showOrder && "rotate-180")} aria-hidden />
        </button>
        {showOrder && (
          <ul className="flex flex-col gap-2 border-t px-3 py-3">
            {session.concepts.map((c) => (
              <li key={c.id} className="flex flex-col text-sm">
                <span className="font-medium">
                  {c.name}
                  {c.lesson && <span className="ml-2 font-mono text-xs text-muted-foreground">{c.lesson}</span>}
                </span>
                <span className="text-muted-foreground">{c.after.length ? `after ${c.after.join(", ")}` : "no prerequisite to study first"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {session.look.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">What to review</p>
          {session.look.map((l) => (
            <div key={l.passage.id} className="flex flex-col gap-1">
              {l.note && <p className="text-sm">{l.note}</p>}
              <SourceRef sourceTitle={l.passage.sourceTitle} locator={l.passage.locator} text={l.passage.text} />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
