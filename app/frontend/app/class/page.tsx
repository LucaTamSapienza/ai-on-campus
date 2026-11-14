"use client";

// Classe simulata: otto studenti sintetici sostengono una domanda dell'esame, ognuno con i soli
// passaggi delle lezioni che ha seguito; il Correttore dà il voto con la griglia del docente.
// La domanda scelta sta nell'indirizzo (?q=id), per l'export statico.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Users } from "lucide-react";
import { ApiError, classeApi, esameApi, type ExamQuestion } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassBoard } from "@/components/class/class-board";
import { ClassSummary } from "@/components/class/class-summary";
import { StudentDetail } from "@/components/class/student-detail";
import { useClassRun } from "@/components/class/use-class-run";
import { toastError } from "@/components/ui/sonner";

export default function ClassePage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-40" />}>
      <Classe />
    </Suspense>
  );
}

function Classe() {
  const params = useSearchParams();
  const router = useRouter();
  const { course, courseLoading } = useShell();
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [students, setStudents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!course) return;
    (async () => {
      try {
        const exams = await esameApi.exams(course.id);
        const qs = exams[0] ? (await esameApi.exam(exams[0].id)).questions : [];
        setQuestions(qs);
        setStudents((await classeApi.students(course.id)).length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to reach the server. Check the connection and try again.");
      }
    })();
  }, [course]);

  const questionId = params.get("q") ?? questions?.[0]?.id ?? null;

  if (courseLoading) return <Skeleton className="m-6 h-40" />;
  if (!course) return <EmptyState icon={Users} title="No course yet" description="Upload the course materials first." />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8 lg:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold lg:text-title">Simulated class</h1>
          <p className="text-base text-muted-foreground">
            Before the exam, {students ?? 8} synthetic students sit the question, each with notes from the lessons they attended. The Grader
            applies your rubric.
          </p>
        </header>
        <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            A simulation on synthetic profiles, not a prediction of real grades. Each student has limited access to the course passages,
            but the model still knows the subject.
          </span>
        </p>

        {error ? (
          <p className="text-base text-destructive">{error}</p>
        ) : questions === null ? (
          <Skeleton className="h-28 w-full" />
        ) : questions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No questions yet"
            description="The class answers the exam questions. Write one with its rubric."
            action={<Button onClick={() => router.push("/exam?new=1")}>New question</Button>}
          />
        ) : (
          <>
            <QuestionPicker questions={questions} selected={questionId} onSelect={(id) => router.replace(`/class?q=${id}`)} />
            {questionId && <QuestionRun key={questionId} questionId={questionId} disabled={students === 0} />}
          </>
        )}
      </div>
    </div>
  );
}

function QuestionPicker({ questions, selected, onSelect }: { questions: ExamQuestion[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <section aria-label="Question" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {questions.map((q, i) => (
        <button
          key={q.id}
          type="button"
          aria-pressed={selected === q.id}
          onClick={() => onSelect(q.id)}
          className={cn(
            "flex min-h-11 flex-col gap-1 rounded-lg border bg-card p-4 text-left transition-colors duration-150 ease-out outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring",
            selected === q.id && "border-primary bg-primary-soft ring-1 ring-primary",
          )}
        >
          <span className="text-sm font-semibold">
            Question {i + 1} · version {q.version.version}
          </span>
          <span className="line-clamp-1 text-sm text-muted-foreground lg:line-clamp-2">{q.version.text}</span>
        </button>
      ))}
    </section>
  );
}

// Una domanda: l'ultima esecuzione della classe, se c'è, e l'azione per farne una nuova.
function QuestionRun({ questionId, disabled }: { questionId: string; disabled: boolean }) {
  const [runId, setRunId] = useState<string | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    classeApi
      .last(questionId)
      .then((r) => setRunId(r?.id ?? null))
      .catch(() => setRunId(null));
  }, [questionId]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const { runId } = await classeApi.start(questionId);
      setRunId(runId);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "The class did not start. Try again.");
    } finally {
      setStarting(false);
    }
  }, [questionId]);

  if (runId === undefined) return <Skeleton className="h-40 w-full" />;
  return (
    <>
      {runId ? (
        <RunView key={runId} runId={runId} onRestart={start} starting={starting} disabled={disabled} />
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-base text-muted-foreground">The class has not answered this question yet.</p>
          <Button onClick={start} disabled={starting || disabled}>
            Run the class
          </Button>
        </div>
      )}
    </>
  );
}

function RunView({ runId, onRestart, starting, disabled }: { runId: string; onRestart: () => void; starting: boolean; disabled: boolean }) {
  const { run, live, error } = useClassRun(runId);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  if (error && !run) return <p className="text-base text-destructive">{error}</p>;
  if (!run) return <Skeleton className="h-64 w-full" />;
  const running = run.status === "running";
  const done = run.answers.filter((a) => a.status === "done" || a.status === "error").length;
  const step = running ? (live?.step === "recupero" || !run.retrieval ? "Retrieving course passages" : `Answering: ${done} of ${run.answers.length} graded`) : null;
  const student = run.students.find((s) => s.id === selected) ?? null;
  const answer = run.answers.find((a) => a.studentId === selected) ?? null;

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-base text-muted-foreground" aria-live="polite">
          {running
            ? step
            : run.status === "error"
              ? `Run stopped: ${run.error ?? "error"}`
              : `Question version ${run.version.version} · ${run.passages.length} passages retrieved from the course`}
        </p>
        <Button onClick={onRestart} disabled={running || starting || disabled} variant={running ? "outline" : "default"}>
          {running ? "The class is answering" : "Run the class again"}
        </Button>
      </div>
      <ClassBoard run={run} live={live} selected={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} />
      <div ref={detailRef} className="scroll-mt-6 empty:hidden">
        {student && answer && <StudentDetail run={run} student={student} answer={answer} />}
      </div>
      {run.summary ? (
        <ClassSummary summary={run.summary} total={run.answers.length} />
      ) : running ? (
        <Skeleton className="h-48 w-full" />
      ) : null}
    </>
  );
}
