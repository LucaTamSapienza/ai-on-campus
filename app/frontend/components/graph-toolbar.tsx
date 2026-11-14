"use client";

// Ricerca e filtri sopra la tela. Desktop: campo e chip degli argomenti. Telefono: campo e
// pulsante che apre i filtri in un foglio dal basso.
import { useMemo, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { List, Search, SlidersHorizontal, X } from "lucide-react";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="pointer-events-auto bg-card shadow-float aria-pressed:border-primary aria-pressed:text-primary"
          onClick={props.onToggleList}
          aria-pressed={props.listOpen}
          aria-label="Elenco dei concetti"
        >
          <List className="size-5" />
        </Button>
        <ConceptSearch concepts={props.concepts} onPick={props.onPick} />
        {!isDesktop && props.topics.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            className="pointer-events-auto relative bg-card shadow-float"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtra per argomento"
          >
            <SlidersHorizontal className="size-5" />
            {props.activeTopics.size > 0 && (
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {props.activeTopics.size}
              </span>
            )}
          </Button>
        )}
      </div>
      {isDesktop && (
        <div className="pointer-events-auto -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <TopicChips {...props} nowrap />
        </div>
      )}
      {!isDesktop && (
        <DrawerPrimitive.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerPrimitive.Portal>
            <DrawerPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
            <DrawerPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-(--sheet-max-height) flex-col gap-4 rounded-t-2xl border-t bg-card px-4 pt-2 pb-(--sheet-padding-bottom) outline-none"
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" aria-hidden />
              <DrawerPrimitive.Title className="text-lg font-semibold">Argomenti</DrawerPrimitive.Title>
              <div className="overflow-y-auto">
                <TopicChips {...props} />
              </div>
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Portal>
        </DrawerPrimitive.Root>
      )}
    </div>
  );
}

function TopicChips({ topics, slotOf, activeTopics, onToggleTopic, onClearTopics, nowrap }: Props & { nowrap?: boolean }) {
  if (topics.length === 0) return null;
  return (
    <div className={cn("pointer-events-auto flex gap-2", nowrap ? "w-max" : "flex-wrap")} role="group" aria-label="Filtra per argomento">
      {topics.map((t) => {
        const on = activeTopics.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggleTopic(t.id)}
            title={t.summary}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium transition-colors duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TopicDot slot={slotOf(t.id)} />
            {t.name}
          </button>
        );
      })}
      {activeTopics.size > 0 && (
        <button
          type="button"
          onClick={onClearTopics}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden /> Tutti
        </button>
      )}
    </div>
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
        placeholder="Cerca un concetto"
        aria-label="Cerca un concetto"
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
                className="flex min-h-11 w-full items-center px-4 text-left text-base outline-none hover:bg-muted focus-visible:bg-muted"
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
