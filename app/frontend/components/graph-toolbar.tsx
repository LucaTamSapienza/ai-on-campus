"use client";

// Ricerca e filtri sopra la tela. Accanto alla ricerca il pulsante «Topics» riassume gli argomenti
// attivi e apre la legenda: su desktop un pannello sotto la barra, sul telefono un foglio dal
// basso, con lo stesso contenuto (tutti gli argomenti a capo, colore, nome intero, concetti,
// selezione multipla e «Clear»). A legenda chiusa la tela resta scoperta.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Check, ChevronDown, List, Search, SlidersHorizontal } from "lucide-react";
import type { GraphConcept, Topic } from "@/lib/api";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { TopicDot } from "@/components/topic-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  concepts: GraphConcept[];
  topics: Topic[];
  slotOf: (topicId: string | null) => number | null;
  activeTopics: Set<string>;
  onToggleTopic: (id: string) => void;
  onClearTopics: () => void;
  onPick: (id: string) => void;
  listOpen: boolean;
  onToggleList: () => void;
};

export function GraphToolbar(props: Props) {
  const isDesktop = useIsDesktop();
  const [legendOpen, setLegendOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pannello desktop: si chiude con Esc (il fuoco torna al pulsante) o toccando fuori.
  useEffect(() => {
    if (!legendOpen || !isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setLegendOpen(false);
      triggerRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setLegendOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [legendOpen, isDesktop]);

  const hasTopics = props.topics.length > 0;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="pointer-events-auto bg-card shadow-float aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-strong"
          onClick={props.onToggleList}
          aria-pressed={props.listOpen}
          aria-label="Concept list"
        >
          <List className="size-5" />
        </Button>
        <ConceptSearch concepts={props.concepts} onPick={props.onPick} />
        {hasTopics && (
          <TopicsButton
            ref={triggerRef}
            compact={!isDesktop}
            topics={props.topics}
            activeTopics={props.activeTopics}
            slotOf={props.slotOf}
            open={legendOpen}
            controls={isDesktop ? panelId : undefined}
            onClick={() => setLegendOpen((o) => !o)}
          />
        )}
      </div>
      {isDesktop && legendOpen && hasTopics && (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-label="Topics"
          className="pointer-events-auto flex max-h-(--topic-panel-max-height) w-full max-w-(--topic-panel-width) flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border bg-card p-4 shadow-float animate-in duration-150 ease-out fade-in-0 motion-safe:slide-in-from-top-1"
        >
          <TopicLegend {...props} />
        </div>
      )}
      {!isDesktop && (
        <DrawerPrimitive.Root open={legendOpen} onOpenChange={setLegendOpen}>
          <DrawerPrimitive.Portal>
            <DrawerPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
            <DrawerPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-(--sheet-max-height) flex-col gap-3 rounded-t-2xl border-t bg-card px-4 pt-2 pb-(--sheet-padding-bottom) outline-none"
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" aria-hidden />
              <DrawerPrimitive.Title className="sr-only">Topics</DrawerPrimitive.Title>
              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain">
                <TopicLegend {...props} />
              </div>
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Portal>
        </DrawerPrimitive.Root>
      )}
    </div>
  );
}

// Pulsante «Topics»: su desktop nome, pallini degli argomenti attivi e quanti sono; sul telefono
// solo icona e numero. Il nome accessibile dice sempre quanti argomenti filtrano il grafo.
function TopicsButton({
  ref,
  compact,
  topics,
  activeTopics,
  slotOf,
  open,
  controls,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  compact: boolean;
  topics: Topic[];
  activeTopics: Set<string>;
  slotOf: Props["slotOf"];
  open: boolean;
  controls?: string;
  onClick: () => void;
}) {
  const active = topics.filter((t) => activeTopics.has(t.id));
  const label = active.length === 0 ? "Topics, showing all" : `Topics, ${active.length} selected`;
  if (compact)
    return (
      <Button
        ref={ref}
        variant="outline"
        size="icon"
        className="pointer-events-auto relative bg-card shadow-float"
        onClick={onClick}
        aria-label={label}
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-5" />
        {active.length > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground tabular-nums">
            {active.length}
          </span>
        )}
      </Button>
    );
  return (
    <Button
      ref={ref}
      variant="outline"
      className={cn(
        "pointer-events-auto h-11 gap-2 bg-card px-4 text-base shadow-float",
        active.length > 0 && "border-primary bg-primary-soft text-primary-strong hover:bg-primary-soft",
      )}
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
    >
      <SlidersHorizontal className="size-5" aria-hidden />
      Topics
      {active.length > 0 && (
        <span className="flex items-center gap-1" aria-hidden>
          <span className="flex -space-x-0.5">
            {active.slice(0, 3).map((t) => (
              <TopicDot key={t.id} slot={slotOf(t.id)} className="ring-2 ring-card" />
            ))}
          </span>
          <span className="tabular-nums">{active.length}</span>
        </span>
      )}
      <ChevronDown className={cn("size-4 duration-150 ease-out motion-safe:transition-transform", open && "rotate-180")} aria-hidden />
    </Button>
  );
}

// Legenda e filtro insieme: ogni riga è un argomento (pallino, nome intero, concetti) che si
// accende o si spegne; con almeno un argomento acceso il grafo mostra solo quelli.
function TopicLegend({ topics, concepts, slotOf, activeTopics, onToggleTopic, onClearTopics }: Props) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of concepts) if (c.topicId) m.set(c.topicId, (m.get(c.topicId) ?? 0) + 1);
    return m;
  }, [concepts]);
  return (
    <>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-base font-semibold">Topics</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {activeTopics.size === 0 ? `All ${topics.length} shown. Pick one or more to filter.` : `${activeTopics.size} of ${topics.length} selected`}
          </p>
        </div>
        <Button variant="ghost" className="h-11 px-3 text-base text-primary" onClick={onClearTopics} disabled={activeTopics.size === 0}>
          Clear
        </Button>
      </div>
      <div className="grid gap-1 sm:grid-cols-2" role="group" aria-label="Filter by topic">
        {topics.map((t) => {
          const on = activeTopics.has(t.id);
          const n = counts.get(t.id) ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleTopic(t.id)}
              aria-label={`${t.name}, ${n} concepts`}
              className={cn(
                "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",
                on && "bg-primary-soft hover:bg-primary-soft",
              )}
            >
              <TopicDot slot={slotOf(t.id)} />
              <span className="text-pretty">{t.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-sm border border-input transition-colors duration-150 ease-out",
                  on && "border-primary bg-primary text-primary-foreground",
                )}
                aria-hidden
              >
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ConceptSearch({ concepts, onPick }: { concepts: GraphConcept[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return concepts
      .filter((c) => c.name.toLowerCase().includes(s))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(s)) - Number(!b.name.toLowerCase().startsWith(s)) || b.degree - a.degree)
      .slice(0, 6);
  }, [q, concepts]);

  const pick = (id: string) => {
    onPick(id);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="pointer-events-auto relative min-w-0 flex-1 lg:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={q}
        placeholder="Search a concept"
        aria-label="Search a concept"
        className="pl-10 shadow-float"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) pick(matches[0].id);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && matches.length > 0 && (
        <ul className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-lg border bg-card shadow-float" role="listbox">
          {matches.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c.id)}
                className="flex min-h-11 w-full items-center px-4 text-left text-base outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
