"use client";

// Il dettaglio di uno studente sintetico: profilo, cosa aveva in mano, risposta, voto per
// criterio, concetti mancanti. Tutto testo, mai HTML.
import type { ClassAnswer, ClassRunDetail, Grade, Student } from "@/lib/api";
import { shortSource } from "@/lib/graph-style";
import { GradeView, PassageRef } from "@/components/exam/shared";

export function StudentDetail({ run, student, answer }: { run: ClassRunDetail; student: Student; answer: ClassAnswer }) {
  const received = run.passages.filter((p) => answer.passageIds.includes(p.id));
  const grade: Grade | null =
    answer.status === "done" && answer.total !== null
      ? { readingIndex: 0, total: answer.total, max: answer.max ?? run.version.maxPoints, perCriterion: answer.perCriterion, error: null }
      : null;
  return (
    <section aria-label={`Answer by ${student.name}`} className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{student.name}</h2>
        <p className="text-sm text-muted-foreground">
          Synthetic profile · average {student.priorGrade} · {student.style}
        </p>
        <p className="font-mono text-sm text-muted-foreground">
          Lessons attended: {student.lessons.map((l) => shortSource(l.title)).join(", ") || "none"}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">What they had</h3>
        <p className="text-sm text-muted-foreground">
          The question and {received.length} of the {run.passages.length} retrieved passages: only those from lessons they attended. No rubric.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Answer</h3>
        <p className="text-base whitespace-pre-line">{answer.answer ?? (answer.status === "error" ? answer.error : "Still writing.")}</p>
      </div>

      {grade && <GradeView grade={grade} label="Grader's score" />}

      {answer.missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Concepts missing from the notes</h3>
          <ul className="flex flex-wrap gap-2">
            {answer.missing.map((m) => (
              <li key={m.id} className="rounded-full border px-3 py-1 text-sm">
                {m.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {received.length > 0 && (
        <details className="group flex flex-col gap-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Passages received ({received.length})
          </summary>
          <div className="flex flex-col gap-2">
            {received.map((p) => (
              <PassageRef key={p.id} passage={p} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
