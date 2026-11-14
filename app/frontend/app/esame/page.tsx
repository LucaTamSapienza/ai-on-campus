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
import { QuestionForm, QuestionList } from "@/components/esame/question-list";
import { QuestionView } from "@/components/esame/question-view";

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
  const creating = params.get("nuova") === "1";
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
      setError(e instanceof Error ? e.message : "Errore");
    }
  }, [course]);

  useEffect(() => {
    if (!questionId) load();
  }, [load, questionId]);

  const ensureExam = useCallback(async () => {
    if (exam) return exam.id;
    const created = await esameApi.createExam(course!.id, "Esame");
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
  if (!course) return <EmptyState icon={ClipboardList} title="Nessun corso" description="Prima carica il materiale del corso." />;

  if (creating) {
    return (
      <PageColumn title="Nuova domanda" description="Il testo e la griglia di correzione: senza griglia non si corregge e non si attacca.">
        <QuestionForm examId={ensureExam} onCreated={(id) => router.push(`/esame?q=${id}`)} onCancel={() => router.push("/esame")} />
      </PageColumn>
    );
  }

  return (
    <PageColumn
      title={exam?.title ?? "Esame"}
      description="Ogni domanda passa da tre attacchi: un modello senza il corso, uno con i passaggi del corso, uno che cerca due letture."
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
          title="Nessuna domanda"
          description="Scrivi una domanda con la sua griglia: poi la metti alla prova."
          action={<Button onClick={() => router.push("/esame?nuova=1")}>Nuova domanda</Button>}
        />
      ) : (
        <QuestionList questions={questions} onNew={() => router.push("/esame?nuova=1")} />
      )}
    </PageColumn>
  );
}
