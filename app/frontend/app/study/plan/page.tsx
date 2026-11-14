"use client";

// study plan page: il piano di studio a pagina intera, come documento, con il PDF da scaricare.
// Rotta /study/plan?p=<planId> (export statico, niente segmenti dinamici). La pagina sta sopra
// il guscio, fuori dalla navigazione: si monta in un portale su <body>, così anche la stampa
// mostra solo il documento. Legge il piano dalle API esistenti, in sola lettura.
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { studioApi, type StudioOptions, type StudyPlan } from "@/lib/api";
import { useShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanDocument } from "@/components/study/plan-document";
import { buildPlanDocument, planFileName } from "@/components/study/plan-document-shared";

// La pagina del piano nell'app.
const STUDY_PATH = "/study";

// In stampa resta solo il documento: il guscio e gli avvisi spariscono, A4 con margini.
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 18mm 16mm; }
  html, body { height: auto !important; overflow: visible !important; }
  body > *:not([data-plan-document]) { display: none !important; }
}`;

const noopSubscribe = () => () => {};

export default function StudyPlanPage() {
  // Il portale su <body> esiste solo nel browser: nell'export statico la pagina parte vuota.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div data-plan-document className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-background print:static print:overflow-visible">
      <style>{PRINT_CSS}</style>
      <Suspense fallback={<DocumentSkeleton />}>
        <StudyPlan />
      </Suspense>
    </div>,
    document.body,
  );
}

function StudyPlan() {
  const params = useSearchParams();
  const planId = params.get("p");
  const { course, courseLoading } = useShell();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [options, setOptions] = useState<StudioOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    if (!planId) return;
    studioApi.plan(planId).then(
      (next) => {
        setPlan(next);
        setError(null);
      },
      (e) => setError(e instanceof Error ? e.message : "The plan could not be loaded."),
    );
  }, [planId]);

  useEffect(load, [load]);

  // Finché il Pianificatore scrive, il documento si rilegge ogni 3 secondi.
  const running = plan?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [running, load]);

  // I nomi di lezioni e concetti già noti: il piano ha solo gli identificatori.
  useEffect(() => {
    if (!course) return;
    studioApi.options(course.id).then(setOptions, () => setOptions(null));
  }, [course]);

  const data = useMemo(() => (plan && course ? buildPlanDocument(plan, course.name, options) : null), [plan, course, options]);
  const backHref = planId ? `${STUDY_PATH}?p=${encodeURIComponent(planId)}` : STUDY_PATH;

  const download = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const { renderPlanPdf } = await import("@/components/study/plan-document-pdf");
      const blob = await renderPlanPdf(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = planFileName(data);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      toast.error("The PDF could not be created. Try again, or use your browser's Print to save it.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-10 border-b bg-card pt-(--safe-top) print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <Button asChild variant="ghost" className="-ml-3">
            <Link href={backHref}>
              <ArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
          <Button onClick={download} disabled={!data || running || plan?.status === "error" || downloading}>
            {downloading ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {downloading ? "Preparing PDF" : "Download PDF"}
          </Button>
        </div>
      </div>

      {!planId ? (
        <Message text="No plan selected. Create a study plan first, then open it from there." href={STUDY_PATH} />
      ) : error && !plan ? (
        <Message text={`${error} Check the link, or create a new plan.`} href={STUDY_PATH} />
      ) : !course && !courseLoading ? (
        <Message text="No course found." href={STUDY_PATH} />
      ) : data ? (
        <PlanDocument data={data} pending={running} />
      ) : (
        <DocumentSkeleton />
      )}
    </>
  );
}

function Message({ text, href }: { text: string; href: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-12">
      <p className="text-base">{text}</p>
      <Button asChild variant="outline">
        <Link href={href}>Go to the study plan</Link>
      </Button>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12" aria-label="Loading the plan">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
