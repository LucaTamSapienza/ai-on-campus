"use client";

// Prima e dopo: le versioni della domanda in fila, con i voti dei tre agenti su ciascuna.
import type { VersionOutcome } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AGENT_META, fmt, VerdictBadge } from "./shared";

const ORIGIN: Record<string, string> = {
  docente: "scritta dal docente",
  proposta_approvata: "proposta del Revisore, approvata",
  proposta_modificata: "proposta del Revisore, modificata dal docente",
};

export function Versions({ versions, currentVersionId }: { versions: VersionOutcome[]; currentVersionId: string | null }) {
  if (versions.length < 2) return null;
  return (
    <section aria-label="Prima e dopo" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Prima e dopo</h2>
      <ol className="grid gap-4 lg:grid-cols-2">
        {versions.map(({ version, outcome }) => (
          <li key={version.id} className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", version.id === currentVersionId && "border-primary")}>
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">Versione {version.version}</p>
              <p className="text-sm text-muted-foreground">{ORIGIN[version.origin]}</p>
            </div>
            <p className="line-clamp-6 text-sm whitespace-pre-wrap">{version.text}</p>
            {outcome ? (
              <>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {outcome.agents.map((a) => {
                    const graded = a.grades.filter((g) => g.total !== null);
                    const value =
                      a.status !== "done"
                        ? "non ha completato"
                        : a.agent === "cavillatore" && !a.found
                          ? "nessuna seconda lettura"
                          : graded.length
                            ? `${graded.map((g) => fmt(g.total!)).join(" e ")} / ${fmt(graded[0].max)}`
                            : "voto non riuscito";
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
              <p className="text-sm text-muted-foreground">Non ancora attaccata.</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
