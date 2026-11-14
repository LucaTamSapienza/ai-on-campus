"use client";

// Prima e dopo: le versioni della domanda in fila, con i voti dei tre agenti su ciascuna.
import type { VersionOutcome } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AGENT_META, fmt, VerdictBadge } from "./shared";

const ORIGIN: Record<string, string> = {
  docente: "written by the teacher",
  proposta_approvata: "Reviewer's proposal, approved",
  proposta_modificata: "Reviewer's proposal, edited by the teacher",
};

export function Versions({ versions, currentVersionId }: { versions: VersionOutcome[]; currentVersionId: string | null }) {
  if (versions.length < 2) return null;
  return (
    <section aria-label="Before and after" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Before and after</h2>
      <ol className="grid gap-4 lg:grid-cols-2">
        {versions.map(({ version, outcome }) => (
          <li key={version.id} className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", version.id === currentVersionId && "border-primary")}>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">Version {version.version}</p>
                {/* la versione corrente ha anche un'etichetta, non solo il bordo */}
                {version.id === currentVersionId && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-strong">current</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{ORIGIN[version.origin]}</p>
            </div>
            <p className="text-sm whitespace-pre-wrap">{version.text}</p>
            {outcome ? (
              <>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {outcome.agents.map((a) => {
                    const graded = a.grades.filter((g) => g.total !== null);
                    const value =
                      a.status !== "done"
                        ? "did not finish"
                        : a.agent === "cavillatore" && !a.found
                          ? "no second reading"
                          : graded.length
                            ? `${graded.map((g) => fmt(g.total!)).join(" and ")} / ${fmt(graded[0].max)}`
                            : "grading failed";
                    return (
                      <li key={a.agent} className="flex min-h-10 items-center justify-between gap-3 px-3 text-sm">
                        <span className="font-medium">{AGENT_META[a.agent].name}</span>
                        <span className="tabular-nums text-muted-foreground">{value}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {outcome.verdicts.map((v, i) => (
                    <VerdictBadge key={i} kind={v.kind} title={v.title} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not attacked yet.</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
