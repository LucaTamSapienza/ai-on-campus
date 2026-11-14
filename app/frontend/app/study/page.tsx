"use client";

// Piano di studio dello studente: giorni all'appello e cosa conosce già; il backend ordina i
// concetti dal grafo e li divide in sessioni, il Pianificatore spiega ogni sessione citando le
// slide di prova. Il piano aperto sta nell'indirizzo (?p=id), per l'export statico.
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Route, ShieldCheck } from "lucide-react";
import { useShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageColumn } from "@/components/page-column";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanForm } from "@/components/study/plan-form";
import { PlanView } from "@/components/study/plan-view";

export default function StudioPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-40" />}>
      <Studio />
    </Suspense>
  );
}

function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const { course, courseLoading } = useShell();
  const planId = params.get("p");

  if (courseLoading) return <Skeleton className="m-6 h-40" />;
  if (!course) return <EmptyState icon={Route} title="No course yet" description="The study plan is built on the course graph." />;

  return (
    <PageColumn
      title="Study plan"
      description="Tell us how many days are left before the exam and what you already know. The order of the concepts comes from the course graph and respects prerequisites."
    >
      <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          The Planner explains the order and points to the slides to review, only among those already in the graph. It does not see
          questions, rubrics, attacks or class results, and it does not write exam answers. A concept without evidence in the course stays
          marked as such.
        </span>
      </p>
      {planId ? (
        <PlanView key={planId} planId={planId} onNew={() => router.replace("/study")} />
      ) : (
        <PlanForm courseId={course.id} onCreated={(id) => router.replace(`/study?p=${id}`)} />
      )}
    </PageColumn>
  );
}
