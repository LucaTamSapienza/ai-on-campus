"use client";

// Pezzi condivisi della pagina dell'esame: nomi degli agenti, etichette dei verdetti, voti,
// citazioni dei passaggi.
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import type { AttackAgent, Grade, RunPassage, VerdictKind } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SourceRef } from "@/components/source-ref";

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(".", ",");

export const AGENT_META: Record<AttackAgent, { name: string; role: string; holds: (passages: number) => string }> = {
  esterno: {
    name: "Esterno",
    role: "Risponde senza il corso",
    holds: () => "Solo il testo della domanda. Niente materiali del corso, niente griglia.",
  },
  letterale: {
    name: "Letterale",
    role: "Risponde citando il corso",
    holds: (n) => `La domanda e un accesso limitato ai passaggi del corso (${n} recuperati). Niente griglia. Il modello conosce comunque la materia.`,
  },
  cavillatore: {
    name: "Cavillatore",
    role: "Cerca due letture",
    holds: (n) => `La domanda e gli stessi ${n} passaggi. Niente griglia. Cerca una frase che si legge in due modi.`,
  },
};

// Etichetta di un verdetto: testo scuro su bordo, il colore sta nell'icona (contrasto pieno, e il
// colore non è l'unico segnale).
const VERDICT_ICON: Record<VerdictKind, { icon: typeof AlertTriangle; className: string }> = {
  supera_soglia: { icon: AlertTriangle, className: "text-destructive" },
  ambiguita: { icon: AlertTriangle, className: "text-destructive" },
  prove_insufficienti: { icon: Info, className: "text-muted-foreground" },
  incompleta: { icon: Info, className: "text-muted-foreground" },
  nessun_controesempio: { icon: CheckCircle2, className: "text-success" },
};

export function VerdictBadge({ kind, title, className }: { kind: VerdictKind; title: string; className?: string }) {
  const { icon: Icon, className: tone } = VERDICT_ICON[kind];
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm font-medium text-foreground", className)}>
      <Icon className={cn("size-4 shrink-0", tone)} aria-hidden />
      {title}
    </span>
  );
}

// Voto totale con il dettaglio per criterio, espandibile.
export function GradeView({ grade, label }: { grade: Grade; label?: string }) {
  const [open, setOpen] = useState(false);
  if (grade.error || grade.total === null) {
    return <p className="text-sm text-destructive">{label ? `${label}: ` : ""}correzione non riuscita. {grade.error}</p>;
  }
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-sm text-muted-foreground">{label ?? "Voto del Correttore"}</span>
        <span className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {fmt(grade.total)}
            <span className="text-sm font-normal text-muted-foreground"> / {fmt(grade.max)}</span>
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-3 border-t px-3 py-3">
          {grade.perCriterion.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{c.criterion}</span>
                <span className="shrink-0 text-sm tabular-nums">
                  {fmt(c.awarded)}/{fmt(c.max)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{c.why}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Citazione di un passaggio del corso: SourceRef, con sopra la frase citata quando c'è.
export function PassageRef({ passage, quote }: { passage: Pick<RunPassage, "locator" | "sourceTitle" | "text">; quote?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {quote && <p className="text-sm">«{quote}»</p>}
      <SourceRef sourceTitle={passage.sourceTitle} locator={passage.locator} text={passage.text} />
    </div>
  );
}
