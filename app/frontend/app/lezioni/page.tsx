"use client";

// Lezioni: registra una lezione, segna quelle svolte, e gli argomenti che l'app propone per le
// domande (concetti coperti, con le prove). L'app propone soltanto: le domande le scrive il docente.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { ApiError, lezioniApi, type Lesson, type Proposal } from "@/lib/api";
import { shortSource } from "@/lib/graph-style";
import { cn } from "@/lib/utils";
import { useCartografo } from "@/hooks/use-cartografo";
import { useShell } from "@/components/app-shell";
import { AgentStrip } from "@/components/agent-strip";
import { EmptyState } from "@/components/empty-state";
import { PageColumn } from "@/components/page-column";
import { SourceRef } from "@/components/source-ref";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LessonRecorder } from "@/components/lezioni/lesson-recorder";

export default function LezioniPage() {
  const { course, courseLoading } = useShell();
  return (
    <PageColumn title="Lezioni" description="Segna le lezioni svolte: l'app propone su quali concetti fare domande, con le slide che li spiegano.">
      {courseLoading ? <Skeleton className="h-64 w-full" /> : course ? <Lessons courseId={course.id} /> : <p className="text-base">Nessun corso.</p>}
    </PageColumn>
  );
}

function Lessons({ courseId }: { courseId: string }) {
  const cartografo = useCartografo(courseId);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [proposals, setProposals] = useState<{ totals: { concepts: number; covered: number; lessonsDone: number }; proposals: Proposal[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([lezioniApi.lessons(courseId), lezioniApi.proposals(courseId)]);
      setLessons(l);
      setProposals(p);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Non è stato possibile leggere le lezioni.");
    }
  }, [courseId]);

  // Il grafo cambia quando il Cartografo legge una trascrizione: proposte e conteggi si rileggono.
  const revision = cartografo?.graphRevision;
  useEffect(() => {
    load();
  }, [load, revision]);

  const toggle = async (l: Lesson) => {
    const done = !l.doneAt;
    setLessons((ls) => ls?.map((x) => (x.id === l.id ? { ...x, doneAt: done ? "ora" : null } : x)) ?? null);
    try {
      await lezioniApi.setDone(l.id, done);
      setProposals(await lezioniApi.proposals(courseId));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Non è stato possibile salvare.");
      load();
    }
  };

  return (
    <>
      <LessonRecorder courseId={courseId} onAdded={load} />
      <AgentStrip state={cartografo} />

      <section aria-label="Lezioni svolte" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Lezioni svolte</h2>
          {lessons && (
            <span className="text-sm text-muted-foreground">
              {lessons.filter((l) => l.doneAt).length} di {lessons.length}
            </span>
          )}
        </div>
        {lessons === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {lessons.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  aria-pressed={!!l.doneAt}
                  onClick={() => toggle(l)}
                  title={l.title}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors duration-150 ease-out outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                    l.doneAt && "border-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border transition-colors duration-150",
                      l.doneAt && "border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden
                  >
                    {l.doneAt && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 truncate">
                    {l.kind === "transcript" ? <span>{l.title}</span> : <span className="font-mono font-medium">{shortSource(l.title)}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {l.kind === "transcript" ? "registrata" : "slide"} · {l.conceptCount} concetti
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Argomenti proposti" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Su cosa fare domande</h2>
          <p className="text-sm text-muted-foreground">
            {proposals
              ? `Concetti spiegati nelle lezioni svolte (${proposals.totals.covered} su ${proposals.totals.concepts}): prima quelli che nessuna domanda tocca ancora, poi i più collegati nel grafo. È una proposta: la domanda la scrivi tu.`
              : " "}
          </p>
        </div>
        {proposals === null ? (
          <Skeleton className="h-40 w-full" />
        ) : proposals.proposals.length === 0 ? (
          <div className="rounded-lg border bg-card py-8">
            <EmptyState icon={Lightbulb} title="Nessuna lezione svolta" description="Segna le lezioni fatte in aula: qui compaiono i concetti su cui fare domande." />
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {proposals.proposals.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold">{p.name}</h3>
                      <span className="text-sm text-muted-foreground">{p.asked ? "già in una domanda" : "nessuna domanda lo tocca ancora"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.topicName ?? "Senza argomento"} · {p.degree} collegamenti nel grafo · {p.evidence} slide nelle lezioni svolte
                    </p>
                    {p.definition && <p className="text-sm">{p.definition}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {p.passages.map((x) => (
                      <SourceRef key={x.id} sourceTitle={x.sourceTitle} locator={x.locator} text={x.text} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="lg:self-start">
              <Link href="/esame?nuova=1">Scrivi una domanda</Link>
            </Button>
          </>
        )}
      </section>
    </>
  );
}
