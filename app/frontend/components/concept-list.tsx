"use client";

// Elenco dei concetti, ricercabile e collegato alla tela: toccare una voce seleziona il nodo
// e il nodo selezionato è evidenziato qui. Alternativa accessibile alla tela.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { GraphConcept } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TopicDot } from "@/components/topic-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  concepts: GraphConcept[];
  slotOf: (topicId: string | null) => number | null;
  selectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
  className?: string;
};

export function ConceptList({ concepts, slotOf, selectedId, onPick, onClose, className }: Props) {
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return concepts.filter((c) => !s || c.name.toLowerCase().includes(s)).sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [q, concepts]);

  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <section className={cn("flex min-h-0 flex-col bg-card", className)} aria-label="Concept list">
      <div className="flex items-center gap-2 border-b p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Filter ${concepts.length} concepts`}
            aria-label="Filter concepts"
            className="pl-10"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close the list">
          <X className="size-5" />
        </Button>
      </div>
      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2" role="listbox" aria-label="Concepts">
        {items.map((c) => (
          <li key={c.id} role="option" aria-selected={c.id === selectedId} data-id={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-base outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:bg-muted",
                c.id === selectedId && "bg-muted font-semibold text-primary",
              )}
            >
              <TopicDot slot={slotOf(c.topicId)} />
              <span className="min-w-0 flex-1 break-words">{c.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums" aria-label={`${c.degree} relations`}>
                {c.degree}
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-3 text-base text-muted-foreground">No concept with this name.</li>}
      </ul>
    </section>
  );
}
