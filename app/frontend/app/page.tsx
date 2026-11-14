"use client";

// Il grafo del corso: concetti e relazioni, in stile Obsidian.
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2, Network } from "lucide-react";
import { api, type Graph } from "@/lib/api";
import { useCartografo } from "@/hooks/use-cartografo";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useShell } from "@/components/app-shell";
import { AgentStrip } from "@/components/agent-strip";
import { ConceptList } from "@/components/concept-list";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { GraphToolbar } from "@/components/graph-toolbar";
import { Button } from "@/components/ui/button";

const GraphCanvas = dynamic(() => import("@/components/graph-canvas"), { ssr: false });

export default function GraphPage() {
  const { course, courseLoading, courseError } = useShell();
  if (courseLoading) return <CenteredLoader label="Carico il corso" />;
  if (courseError) return <EmptyState icon={Network} title="Il server non risponde" description={courseError} />;
  if (!course)
    return (
      <EmptyState
        icon={Network}
        title="Nessun corso"
        description="Crea il corso e carica la prima lezione: il Cartografo ne estrae i concetti."
        action={
          <Button asChild>
            <Link href="/materiali">Vai ai materiali</Link>
          </Button>
        }
      />
    );
  return <CourseGraph courseId={course.id} />;
}

function CourseGraph({ courseId }: { courseId: string }) {
  const { role } = useShell();
  const cartografo = useCartografo(courseId);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTopics, setActiveTopics] = useState<Set<string>>(new Set());
  const [centerOn, setCenterOn] = useState<{ id: string; nonce: number } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const load = useCallback(() => {
    api
      .graph(courseId)
      .then((g) => {
        setGraph(g);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Errore"));
  }, [courseId]);

  // Si rilegge il grafo all'avvio e a ogni scrittura del Cartografo.
  const version = cartografo?.graphRevision;
  useEffect(() => {
    load();
  }, [load, version]);

  // Posizione dell'argomento nella palette (token --topic-N); null = senza argomento.
  const slotOf = useMemo(() => {
    const byId = new Map((graph?.topics ?? []).map((t, i) => [t.id, i]));
    return (topicId: string | null) => (topicId ? (byId.get(topicId) ?? null) : null);
  }, [graph?.topics]);

  const focus = (id: string) => {
    setSelectedId(id);
    setCenterOn({ id, nonce: Date.now() });
  };

  if (error && !graph) return <EmptyState icon={Network} title="Il grafo non si carica" description={error} />;
  if (!graph) return <CenteredLoader label="Carico il grafo" />;

  const working = cartografo?.status === "working";
  if (graph.concepts.length === 0 && !working)
    return (
      <EmptyState
        icon={Network}
        title="Il grafo è vuoto"
        description="Carica una lezione: il Cartografo ne estrae i concetti e li collega."
        action={
          role === "docente" ? (
            <Button asChild>
              <Link href="/materiali">Carica una lezione</Link>
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <div className="flex h-full">
      {listOpen && isDesktop && (
        <ConceptList
          concepts={graph.concepts}
          slotOf={slotOf}
          selectedId={selectedId}
          onPick={focus}
          onClose={() => setListOpen(false)}
          className="w-(--list-width) shrink-0 border-r animate-in duration-250 ease-out slide-in-from-left-8 fade-in-0"
        />
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <GraphCanvas
          graph={graph}
          slotOf={slotOf}
          selectedId={selectedId}
          onSelect={(id) => (id && !isDesktop ? focus(id) : setSelectedId(id))}
          activeTopics={activeTopics}
          centerOn={centerOn}
          coveredBottom={isDesktop ? 0 : 0.5}
        />
        <GraphToolbar
          concepts={graph.concepts}
          topics={graph.topics}
          slotOf={slotOf}
          activeTopics={activeTopics}
          onToggleTopic={(id) =>
            setActiveTopics((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
          onClearTopics={() => setActiveTopics(new Set())}
          onPick={focus}
          listOpen={listOpen}
          onToggleList={() => setListOpen((o) => !o)}
        />
        {listOpen && !isDesktop && (
          <ConceptList
            concepts={graph.concepts}
            slotOf={slotOf}
            selectedId={selectedId}
            onPick={(id) => {
              setListOpen(false);
              focus(id);
            }}
            onClose={() => setListOpen(false)}
            className="absolute inset-0 z-20 animate-in duration-250 ease-out fade-in-0"
          />
        )}
        {graph.concepts.length === 0 && <CenteredLoader label="Il Cartografo sta leggendo" />}
        <AgentStrip state={cartografo} className="absolute inset-x-4 bottom-4 z-10 lg:right-4 lg:left-auto lg:w-(--strip-width)" />
      </div>
      <DetailPanel
        conceptId={selectedId}
        role={role}
        slotOf={slotOf}
        onClose={() => setSelectedId(null)}
        onSelect={focus}
        onChanged={load}
      />
    </div>
  );
}

function CenteredLoader({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 text-base text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
