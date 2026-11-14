"use client";

// Pagina dell'esame: elenco delle domande, nuova domanda, una domanda con il triplo attacco.
// Export statico: la domanda aperta sta nell'indirizzo (?q=id), non in un segmento dinamico.
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { esameApi, type Exam, type ExamQuestion } from "@/lib/api";
import { useShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageColumn } from "@/components/page-column";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionForm, QuestionList } from "@/components/exam/question-list";
import { QuestionView } from "@/components/exam/question-view";

export default function EsamePage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-40" />}>
      <Esame />
    </Suspense>
  );
}

function Esame() {
  const params = useSearchParams();
  const router = useRouter();
  const questionId = params.get("q");
  const creating = params.get("new") === "1";
  const { course, courseLoading } = useShell();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!course) return;
    try {
      const exams = await esameApi.exams(course.id);
      const first = exams[0] ?? null;
      setExam(first);
      setQuestions(first ? (await esameApi.exam(first.id)).questions : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reach the server. Check the connection and try again.");
    }
  }, [course]);

  useEffect(() => {
    if (!questionId) load();
  }, [load, questionId]);

  const ensureExam = useCallback(async () => {
    if (exam) return exam.id;
    const created = await esameApi.createExam(course!.id, "Exam");
    return created.id;
  }, [exam, course]);

  // La domanda ha tre colonne su desktop: colonna più larga di quella delle pagine a elenco.
  if (questionId) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8 lg:py-12">
          <QuestionView key={questionId} questionId={questionId} />
        </div>
      </div>
    );
  }

  if (courseLoading) return <Skeleton className="m-6 h-40" />;
  if (!course) return <EmptyState icon={ClipboardList} title="No course yet" description="Upload the course materials first." />;

  if (creating) {
    return (
      <PageColumn title="New question" description="The text and the grading rubric. Without a rubric there is nothing to grade or attack.">
        <QuestionForm examId={ensureExam} onCreated={(id) => router.push(`/exam?q=${id}`)} onCancel={() => router.push("/exam")} />
      </PageColumn>
    );
  }

  return (
    <PageColumn
      title={exam?.title ?? "Exam"}
      description="Each question faces three attacks: a model without the course, one with the course passages, one that looks for two readings."
    >
      {error ? (
        <p className="text-base text-destructive">{error}</p>
      ) : questions === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No questions yet"
          description="Write a question with its rubric, then put it to the test."
          action={<Button onClick={() => router.push("/exam?new=1")}>New question</Button>}
        />
      ) : (
        <QuestionList questions={questions} onNew={() => router.push("/exam?new=1")} />
      )}
    </PageColumn>
  );
}
