"use client";

// Chi lavora e cosa si passano: recupero → tre attaccanti → Correttore → Revisore.
// Più il percorso del recupero: termini, concetti del grafo, passaggi con il perché.
import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { AttaccoState, RetrievalReason, RunDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PassageRef } from "./shared";

type Step = { key: string; label: string; detail: string; state: "pending" | "running" | "done" | "error" };

export function RunProgress({ run, live }: { run: RunDetail; live: AttaccoState | null }) {
  const attacksDone = run.attacks.filter((a) => a.status === "done" || a.status === "error").length;
  const toGrade = run.attacks.reduce((n, a) => {
    if (a.status !== "done") return n;
    if (a.agent === "cavillatore") return n + ((a.finding as { found?: boolean } | null)?.found ? 2 : 0);
    return n + 1;
  }, 0);
  const graded = run.attacks.reduce((n, a) => n + a.grades.length, 0);
  const closed = run.status !== "running";

  const steps: Step[] = [
    {
      key: "recupero",
      label: "Retrieval",
      detail: run.retrieval ? `${run.retrieval.passages.length} passages` : (live?.agents.recupero.note ?? "Searching the course"),
      state: run.retrieval ? "done" : "running",
    },
    {
      key: "attacco",
      label: "Three attacks",
      detail: `${attacksDone} of 3 done`,
      state: attacksDone === 3 ? "done" : run.retrieval ? "running" : "pending",
    },
    {
      key: "correttore",
      label: "Grader",
      detail: toGrade ? `${graded} of ${toGrade} answers` : "Waiting for answers",
      state: attacksDone === 3 && graded >= toGrade ? "done" : graded > 0 || (attacksDone > 0 && toGrade > 0) ? "running" : "pending",
    },
    {
      key: "revisore",
      label: "Reviewer",
      detail: run.review ? "Report ready" : live?.agents.revisore.status === "running" ? "Writing the report" : "Waiting for scores",
      state: run.review ? "done" : live?.agents.revisore.status === "running" ? "running" : "pending",
    },
  ];
  if (closed) for (const s of steps) if (s.state !== "done") s.state = "error";

  return (
    <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Attack progress">
      {steps.map((s) => (
        <li
          key={s.key}
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-colors duration-150",
            s.state === "running" && "border-accent",
          )}
        >
          <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
            {s.state === "running" ? (
              <Loader2 className="size-4 animate-spin text-accent" />
            ) : s.state === "done" ? (
              <Check className="size-4 text-success" />
            ) : (
              <span className={cn("size-2 rounded-full", s.state === "error" ? "bg-destructive" : "bg-border")} />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold">{s.label}</span>
            <span className="text-xs break-words text-muted-foreground">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const RELATION: Record<string, string> = {
  prerequisito: "prerequisite",
  parte_di: "part of",
  generalizza: "generalizes",
  usa: "uses",
  contrasta: "contrasts",
};

function reasonText(r: RetrievalReason) {
  if (r.via === "termine") return `term: ${r.terms.join(", ")}`;
  if (r.via === "concetto") return `concept: ${r.concept}`;
  return `neighbour of ${r.from} (${RELATION[r.relation] ?? r.relation}): ${r.concept}`;
}

export function RetrievalPath({ run }: { run: RunDetail }) {
  const [open, setOpen] = useState(false);
  const r = run.retrieval;
  if (!r) return null;
  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span className="flex flex-col">
          <span className="text-base font-semibold">Retrieval path</span>
          <span className="text-sm text-muted-foreground">
            {r.terms.length} terms, {r.concepts.length} graph concepts, {r.passages.length} passages
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t px-4 py-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Terms searched</p>
            <div className="flex flex-wrap gap-2">
              {r.terms.map((t) => (
                <span key={t} className="rounded-full bg-muted px-3 py-1 font-mono text-xs">
                  {t}
                </span>
              ))}
            </div>
          </div>
          {r.concepts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Concepts touched</p>
              <div className="flex flex-wrap gap-2">
                {r.concepts.map((c) => (
                  <span
                    key={c.id}
                    className={cn("rounded-full px-3 py-1 text-sm", c.via === "diretto" ? "bg-primary-soft text-primary-strong" : "bg-muted text-muted-foreground")}
                    title={c.via === "vicino" ? `neighbour of ${c.from}` : "named in the question"}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Passages, in order</p>
            {r.passages.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{p.reasons.map(reasonText).join(" · ")}</p>
                <PassageRef passage={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
