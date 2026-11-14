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
import { PlanForm } from "@/components/studio/plan-form";
import { PlanView } from "@/components/studio/plan-view";

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
  if (!course) return <EmptyState icon={Route} title="Nessun corso" description="Il piano di studio si costruisce sul grafo del corso." />;

  return (
    <PageColumn
      title="Piano di studio"
      description="Dimmi quanti giorni mancano all'appello e cosa conosci già: l'ordine dei concetti viene dal grafo del corso, rispettando i prerequisiti."
    >
      <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          Il Pianificatore spiega l&apos;ordine e indica le slide da guardare, solo fra quelle già nel grafo. Non vede domande, griglie, attacchi
          né risultati della classe, e non scrive risposte d&apos;esame. Un concetto senza prove nel corso resta segnato come tale.
        </span>
      </p>
      {planId ? (
        <PlanView key={planId} planId={planId} onNew={() => router.replace("/studio")} />
      ) : (
        <PlanForm courseId={course.id} onCreated={(id) => router.replace(`/studio?p=${id}`)} />
      )}
    </PageColumn>
  );
}
