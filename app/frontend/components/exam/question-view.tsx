"use client";

// Una domanda: testo e griglia, l'attacco, la scheda, prima e dopo.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { ApiError, esameApi, type QuestionDetail, type RubricItem, type VersionOutcome } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RunBoard } from "./run-board";
import { RetrievalPath, RunProgress } from "./run-progress";
import { Scheda } from "./scheda";
import { fmt } from "./shared";
import { useRun } from "./use-run";
import { Versions } from "./versions";

export function QuestionView({ questionId }: { questionId: string }) {
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [versions, setVersions] = useState<VersionOutcome[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [d, v] = await Promise.all([esameApi.question(questionId), esameApi.versions(questionId)]);
      setDetail(d);
      setVersions(v);
      setRunId((cur) => cur ?? d.lastRun?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [questionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function attack() {
    setStarting(true);
    try {
      const { runId } = await esameApi.attack(questionId);
      setRunId(runId);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.message("An attack is already running on this question.");
        await reload();
      } else toast.error(e instanceof Error ? e.message : "The attack did not start.");
    } finally {
      setStarting(false);
    }
  }

  if (error) return <p className="text-base text-destructive">{error}</p>;
  if (!detail?.version) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  const v = detail.version;
  const lastRun = detail.lastRun && detail.lastRun.id === runId ? detail.lastRun : null;
  const decision = detail.lastDecision;
  const canAttack =
    !runId ||
    (lastRun && lastRun.versionId !== v.id) ||
    (lastRun?.status !== "running" && decision?.action === "tenuta") ||
    lastRun?.status === "error";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/exam"
        className="flex h-11 items-center gap-2 self-start rounded-lg text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden /> All questions
      </Link>

      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Question {detail.question.ordinal} · version {v.version} · {fmt(v.maxPoints)} points
        </p>
        <p className="text-lg font-medium whitespace-pre-wrap lg:text-xl">{v.text}</p>
        <Rubric rubric={v.rubric} />
        {canAttack && (
          <Button onClick={attack} disabled={starting} className="self-stretch sm:self-start">
            {starting ? <Loader2 className="animate-spin" aria-hidden /> : <Swords aria-hidden />}
            {runId ? `Attack version ${v.version}` : "Attack the question"}
          </Button>
        )}
      </header>

      {runId && (
        <RunSection
          key={runId}
          runId={runId}
          currentVersionId={v.id}
          decision={decision}
          onNewRun={(id) => {
            setRunId(id);
            reload();
          }}
          onChanged={reload}
        />
      )}

      <Versions versions={versions} currentVersionId={v.id} />
    </div>
  );
}

function RunSection({
  runId,
  currentVersionId,
  decision,
  onNewRun,
  onChanged,
}: {
  runId: string;
  currentVersionId: string;
  decision: QuestionDetail["lastDecision"];
  onNewRun: (id: string) => void;
  onChanged: () => void;
}) {
  const { run, live, error } = useRun(runId);
  const closed = run && run.status !== "running";

  // A esecuzione chiusa si rileggono domanda e versioni (prima e dopo).
  useEffect(() => {
    if (closed) onChanged();
  }, [closed, onChanged]);

  if (error && !run) return <p className="text-base text-destructive">{error}</p>;
  if (!run) return <Skeleton className="h-40 w-full" />;
  const reviewDecided = decision && run.review && decision.reviewId === run.review.id ? decision.action : null;

  return (
    <div className="flex flex-col gap-6">
      {run.version.id !== currentVersionId && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">This attack covers version {run.version.version}.</p>
      )}
      <RunProgress run={run} live={live} />
      {run.status === "error" && run.error && <p className="text-sm text-destructive">Run closed: {run.error}</p>}
      <RetrievalPath run={run} />
      <RunBoard run={run} live={live} />
      {run.review && (
        <div className="animate-in fade-in duration-250">
          <Scheda run={run} currentVersionId={currentVersionId} decided={reviewDecided} onNewRun={onNewRun} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function Rubric({ rubric }: { rubric: RubricItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-sm font-medium">Grading rubric · {rubric.length} criteria</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="flex flex-col gap-2 border-t px-3 py-3">
          {rubric.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{r.criterion}</span>
                <span className="shrink-0 text-sm tabular-nums">{fmt(r.points)} pt</span>
              </div>
              {r.expected && <p className="text-sm text-muted-foreground">{r.expected}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
