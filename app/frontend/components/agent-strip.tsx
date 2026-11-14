"use client";

// La striscia che dice quale agente lavora e a che punto è.
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { CartografoState } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AgentStrip({ state, className }: { state: CartografoState | null; className?: string }) {
  // Il «fatto» resta visibile qualche secondo, poi la striscia sparisce.
  // Solo se la lettura è finita mentre la pagina era aperta, non a ogni apertura.
  const [showDone, setShowDone] = useState(false);
  const sawWorking = useRef(false);
  useEffect(() => {
    if (state?.status === "working") sawWorking.current = true;
  }, [state?.status]);
  const doneKey = state?.step === "fatto" && state.status === "idle" ? `${state.sourceId}:${state.graphRevision}` : null;
  useEffect(() => {
    if (!doneKey || !sawWorking.current) return;
    setShowDone(true);
    const t = setTimeout(() => setShowDone(false), 6000);
    return () => clearTimeout(t);
  }, [doneKey]);

  const working = state?.status === "working";
  const error = state?.status === "error";
  const visible = working || error || (showDone && !!doneKey);

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none transition-[opacity,translate] duration-250 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        className,
      )}
    >
      {state && visible && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-float">
          {working ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
          ) : error ? (
            <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
          ) : (
            <Check className="size-5 shrink-0 text-success" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              Cartografo
              {state.sourceTitle && <span className="font-normal text-muted-foreground"> · {state.sourceTitle}</span>}
            </p>
            <p className={cn("truncate text-sm text-muted-foreground", error && "text-destructive")}>
              {working && state.step === "estrae" && state.windows > 0
                ? `${state.message} · parte ${state.window} di ${state.windows}`
                : state.message}
            </p>
          </div>
          {(working || doneKey) && (
            <p className="shrink-0 text-right text-sm tabular-nums">
              <span className="font-semibold">+{state.conceptsAdded}</span>
              <span className="text-muted-foreground"> concetti</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
