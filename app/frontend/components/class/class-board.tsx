"use client";

// La classe al lavoro: una scheda per studente sintetico, con il testo che arriva mentre scrive e
// poi il voto del Correttore. Telefono: una colonna. Desktop: quattro colonne.
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ClassAnswer, ClasseState, ClassRunDetail, Student } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmt } from "@/components/exam/shared";

type Props = { run: ClassRunDetail; live: ClasseState | null; selected: string | null; onSelect: (studentId: string) => void };

export function ClassBoard({ run, live, selected, onSelect }: Props) {
  return (
    <section aria-label="The synthetic students" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {run.students.map((s) => {
        const answer = run.answers.find((a) => a.studentId === s.id);
        if (!answer) return null;
        return (
          <StudentCard
            key={s.id}
            student={s}
            answer={answer}
            live={live?.students[s.id] ?? null}
            selected={selected === s.id}
            onSelect={() => onSelect(s.id)}
          />
        );
      })}
    </section>
  );
}

type Phase = "pending" | "running" | "grading" | "done" | "error";

// «Finito» ed «errore» solo da D1; dal vivo si sa chi sta scrivendo e chi è in correzione.
export function phaseOf(answer: ClassAnswer, live: ClasseState["students"][string] | null): Phase {
  if (answer.status === "done" || answer.status === "error") return answer.status;
  if (live?.status === "grading" || (answer.answer && answer.status === "running")) return "grading";
  if (live?.status === "running" || answer.status === "running") return "running";
  return "pending";
}

const PHASE_TEXT: Record<Phase, string> = {
  pending: "Waiting",
  running: "Writing",
  grading: "Being graded",
  done: "Graded",
  error: "Did not finish",
};

function StudentCard({
  student,
  answer,
  live,
  selected,
  onSelect,
}: {
  student: Student;
  answer: ClassAnswer;
  live: ClasseState["students"][string] | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const phase = phaseOf(answer, live);
  const text = answer.answer ?? live?.text ?? "";
  const working = phase === "running" || phase === "grading";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors duration-150 ease-out outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
        working && "border-accent",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold">{student.name}</span>
          <span className="text-sm text-muted-foreground">
            average {fmt(student.priorGrade)} · {student.lessons.length} of 13 lessons
          </span>
        </div>
        <Grade answer={answer} phase={phase} />
      </div>
      <p className={cn("line-clamp-4 min-h-[calc(4lh)] text-sm whitespace-pre-line", text ? "text-foreground" : "text-muted-foreground")}>
        {text || (phase === "pending" ? "Waiting for the question." : phase === "error" ? (answer.error ?? "") : "…")}
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <PhaseIcon phase={phase} />
        <span>{PHASE_TEXT[phase]}</span>
        <span className="ml-auto">{answer.passageIds.length} passages</span>
      </div>
    </button>
  );
}

function Grade({ answer, phase }: { answer: ClassAnswer; phase: Phase }) {
  if (phase !== "done" || answer.total === null) return <span className="h-8 w-12 shrink-0" aria-hidden />;
  return (
    <span className="shrink-0 text-2xl font-semibold tabular-nums">
      {fmt(answer.total)}
      <span className="text-sm font-normal text-muted-foreground">/{fmt(answer.max ?? 0)}</span>
    </span>
  );
}

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === "running" || phase === "grading") return <Loader2 className="size-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden />;
  if (phase === "done") return <CheckCircle2 className="size-4 text-success" aria-hidden />;
  if (phase === "error") return <AlertCircle className="size-4 text-destructive" aria-hidden />;
  return <span className="size-4 rounded-full border" aria-hidden />;
}
