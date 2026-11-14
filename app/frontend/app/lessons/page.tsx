"use client";

// Lezioni: registra una lezione, segna quelle svolte, e gli argomenti che l'app propone per le
// domande (concetti coperti, con le prove). L'app propone soltanto: le domande le scrive il docente.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lightbulb } from "lucide-react";
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
import { LessonRecorder } from "@/components/lessons/lesson-recorder";
import { toastError } from "@/components/ui/sonner";

export default function LezioniPage() {
  const { course, courseLoading } = useShell();
  return (
    <PageColumn title="Lessons" description="Mark the lessons you have taught. The app suggests which concepts to ask about, with the slides that explain them.">
      {courseLoading ? <Skeleton className="h-64 w-full" /> : course ? <Lessons courseId={course.id} /> : <p className="text-base">No course yet.</p>}
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
      toastError(e instanceof ApiError ? e.message : "Could not load the lessons. Try again.");
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
      toastError(e instanceof ApiError ? e.message : "Could not save. Try again.");
      load();
    }
  };

  return (
    <>
      <LessonRecorder courseId={courseId} onAdded={load} />
      <AgentStrip state={cartografo} />

      <section aria-label="Lessons taught" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Lessons taught</h2>
          {lessons && (
            <span className="text-sm text-muted-foreground">
              {lessons.filter((l) => l.doneAt).length} of {lessons.length}
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
                    "flex min-h-11 w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors duration-150 ease-out outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring",
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
                  <span className="min-w-0 break-words">
                    {l.kind === "transcript" ? <span>{l.title}</span> : <span className="font-mono font-medium">{shortSource(l.title)}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {l.kind === "transcript" ? "recorded" : "slides"} · {l.conceptCount} concepts
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Suggested topics" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">What to ask about</h2>
          <p className="text-sm text-muted-foreground">
            {proposals
              ? `Concepts explained in the lessons taught (${proposals.totals.covered} of ${proposals.totals.concepts}): first those no question touches yet, then the most connected in the graph. It is a suggestion. You write the question.`
              : " "}
          </p>
        </div>
        {proposals === null ? (
          <Skeleton className="h-40 w-full" />
        ) : proposals.proposals.length === 0 ? (
          <div className="rounded-lg border bg-card py-8">
            <EmptyState icon={Lightbulb} title="No lessons taught yet" description="Mark the lessons you have taught. The concepts to ask about appear here." />
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {proposals.proposals.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold">{p.name}</h3>
                      <span className="text-sm text-muted-foreground">{p.asked ? "already in a question" : "no question touches it yet"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.topicName ?? "No topic"} · {p.degree} links in the graph · {p.evidence} slides in the lessons taught
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
              <Link href="/exam?new=1">Write a question</Link>
            </Button>
          </>
        )}
      </section>
    </>
  );
}
