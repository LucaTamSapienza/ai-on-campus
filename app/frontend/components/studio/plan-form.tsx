"use client";

// Cosa sceglie lo studente: giorni all'appello, lezioni e concetti che conosce già. Solo numeri e
// identificatori arrivano al server, nessun testo libero.
import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, studioApi, type StudioOptions } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function PlanForm({ courseId, onCreated }: { courseId: string; onCreated: (planId: string) => void }) {
  const [options, setOptions] = useState<StudioOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [lessons, setLessons] = useState<Set<string>>(new Set());
  const [concepts, setConcepts] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    studioApi
      .options(courseId)
      .then(setOptions)
      .catch((e) => setError(e instanceof Error ? e.message : "Errore"));
  }, [courseId]);

  const byId = useMemo(() => new Map(options?.concepts.map((c) => [c.id, c]) ?? []), [options]);
  // Concetti già coperti dalle lezioni scelte: non serve segnarli uno per uno.
  const coveredByLessons = (id: string) => {
    const lessonId = byId.get(id)?.lessonId;
    return !!lessonId && lessons.has(lessonId);
  };
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !options) return [];
    return options.concepts.filter((c) => c.name.toLowerCase().includes(q) && !concepts.has(c.id)).slice(0, 6);
  }, [query, options, concepts]);

  if (error) return <p className="text-base text-destructive">{error}</p>;
  if (!options) return <Skeleton className="h-96 w-full" />;
  if (!options.concepts.length)
    return <p className="text-base text-muted-foreground">Nel grafo del corso non ci sono ancora concetti da mettere in ordine.</p>;

  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };
  const knownCount =
    options.lessons.filter((l) => lessons.has(l.id)).reduce((n, l) => n + l.concepts, 0) + [...concepts].filter((id) => !coveredByLessons(id)).length;
  const toStudy = Math.max(0, options.concepts.length - knownCount);

  const submit = async () => {
    setSending(true);
    try {
      const { planId } = await studioApi.create(courseId, { days, knownLessons: [...lessons], knownConcepts: [...concepts] });
      onCreated(planId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Il piano non è partito. Riprova.");
      setSending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <section className="flex flex-col gap-3" aria-labelledby="studio-days">
        <h2 id="studio-days" className="text-lg font-semibold">
          Quanti giorni mancano all&apos;appello?
        </h2>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" aria-label="Un giorno in meno" disabled={days <= 1} onClick={() => setDays((d) => d - 1)}>
            <Minus aria-hidden />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={options.maxDays}
            value={days}
            onChange={(e) => setDays(Math.min(options.maxDays, Math.max(1, Math.round(Number(e.target.value) || 1))))}
            aria-label="Giorni all'appello"
            className="h-11 w-20 text-center text-lg font-semibold tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Un giorno in più"
            disabled={days >= options.maxDays}
            onClick={() => setDays((d) => d + 1)}
          >
            <Plus aria-hidden />
          </Button>
          <span className="text-base text-muted-foreground">{days === 1 ? "giorno" : "giorni"}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="studio-lessons">
        <div className="flex flex-col gap-1">
          <h2 id="studio-lessons" className="text-lg font-semibold">
            Lezioni che conosci già
          </h2>
          <p className="text-sm text-muted-foreground">
            {options.scope === "svolte"
              ? "Solo le lezioni che il docente ha segnato come svolte."
              : "Il docente non ha ancora segnato lezioni svolte: c'è tutto il corso."}{" "}
            Una lezione conta i concetti che vi compaiono per la prima volta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.lessons.map((l) => {
            const on = lessons.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                aria-label={`${l.short}, ${l.concepts} concetti`}
                title={l.title}
                onClick={() => toggle(lessons, l.id, setLessons)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  on && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {on && <Check className="size-4" aria-hidden />}
                <span className="font-mono">{l.short}</span>
                <span className={cn("text-xs", on ? "text-primary-foreground" : "text-muted-foreground")}>{l.concepts}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="studio-concepts">
        <div className="flex flex-col gap-1">
          <h2 id="studio-concepts" className="text-lg font-semibold">
            Concetti che conosci già
          </h2>
          <p className="text-sm text-muted-foreground">Cerca per nome, i concetti restano nella lingua del corso.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Per esempio Q-learning"
            aria-label="Cerca un concetto"
            className="h-11 pl-9 text-base"
          />
        </div>
        {results.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border bg-card" aria-label="Concetti trovati">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    toggle(concepts, c.id, setConcepts);
                    setQuery("");
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-base outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span className="min-w-0 truncate">{c.name}</span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {concepts.size > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Concetti segnati">
            {[...concepts].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(concepts, id, setConcepts)}
                aria-label={`Togli ${byId.get(id)?.name ?? "concetto"}`}
                className="flex h-11 max-w-full items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium outline-none hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="truncate">{byId.get(id)?.name}</span>
                <X className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t pt-6 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-base text-muted-foreground" aria-live="polite">
          {toStudy} concetti da studiare su {options.concepts.length}
        </p>
        <Button type="submit" disabled={sending || toStudy === 0} className="w-full lg:w-auto">
          {sending ? "Il piano parte" : "Prepara il piano"}
        </Button>
      </div>
    </form>
  );
}
