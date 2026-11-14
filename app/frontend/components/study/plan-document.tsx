// study plan page: il piano di studio come documento, una colonna leggibile con tipografia da
// documento. Lo stesso contenuto va nel PDF (plan-document-pdf.tsx). Tutto il testo è testo.
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_FILES, DOC_TEXT, type PlanDocumentData } from "./plan-document-shared";

export function PlanDocument({ data, pending }: { data: PlanDocumentData; pending: boolean }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-8 lg:py-12 print:max-w-none print:gap-6 print:p-0">
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- export statico, immagini non ottimizzate */}
            <img src={BRAND_FILES.prismaMark} alt="" className="size-8" />
            <span className="text-lg font-bold tracking-wide">{DOC_TEXT.wordmark}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo ufficiale, non modificato */}
          <img src={BRAND_FILES.replyLogo} alt="Reply" className="h-6 w-auto" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold lg:text-title">{DOC_TEXT.title}</h1>
          <p className="text-lg text-muted-foreground">{data.courseName}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3">
          <Meta label="Created" value={data.createdLabel} />
          <Meta label="Days to the exam" value={String(data.days)} />
          <Meta label="Scope" value={data.scopeLabel} />
          <Meta label="To study" value={`${data.toStudy} concepts`} />
          <Meta label="Sessions" value={String(data.sessionCount)} />
          <Meta label="Already known" value={`${data.knownCount} concepts`} />
        </dl>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-muted-foreground">What you already know</h2>
          <p className="text-base">{data.known.length ? data.known.join(", ") : "Nothing marked as known: the plan covers every concept in scope."}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Plan at a glance</h2>
          <ol className="flex flex-col" aria-label="Plan at a glance">
            {data.sessions.map((s) => (
              <li key={s.id} className="grid grid-cols-2 gap-x-4 border-b py-2 text-sm last:border-b-0 sm:grid-cols-[1fr_auto_1fr]">
                <span className="font-semibold">{s.title}</span>
                <span className="text-right text-muted-foreground sm:text-left">{s.concepts.length} concepts</span>
                <span className="col-span-2 font-mono text-xs text-muted-foreground sm:col-span-1 sm:text-right">{s.lessons}</span>
              </li>
            ))}
          </ol>
        </div>
        {pending && (
          <p className="rounded-lg border border-accent px-4 py-3 text-sm" aria-live="polite">
            The Planner is still writing some sessions. They appear here as soon as they are ready, and the PDF unlocks when the plan is complete.
          </p>
        )}
      </header>

      <ol className="flex flex-col gap-10 print:gap-6" aria-label="Study sessions">
        {data.sessions.map((s) => (
          <li key={s.id} className="flex flex-col gap-4 border-t pt-6 break-inside-avoid">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <span className="shrink-0 text-sm text-muted-foreground">{s.concepts.length} concepts</span>
            </div>

            <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2" aria-label="Concepts in study order">
              {s.concepts.map((c, i) => (
                <li key={c.id} className="flex min-w-0 gap-2 text-base">
                  <span className="w-6 shrink-0 text-right text-sm leading-6 tabular-nums text-muted-foreground">{i + 1}.</span>
                  <span className={cn("min-w-0 break-words", c.noEvidence && "underline decoration-dashed decoration-muted-foreground underline-offset-4")}>
                    {c.name}
                    {c.lesson && <span className="ml-2 font-mono text-xs text-muted-foreground">{c.lesson}</span>}
                    {c.noEvidence && <span className="ml-2 text-xs text-muted-foreground">{DOC_TEXT.noEvidence}</span>}
                  </span>
                </li>
              ))}
            </ol>
            {s.withoutEvidence.length > 0 && (
              <p className="text-sm text-muted-foreground">
                No evidence in the course: {s.withoutEvidence.join(", ")}. There are no slides to base them on.
              </p>
            )}

            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-muted-foreground">Why this order</h3>
              {s.why ? (
                <p className="text-base whitespace-pre-line">{s.why}</p>
              ) : (
                <p className="text-base text-muted-foreground">{pending ? "The Planner is writing this session." : "The Planner did not write this session."}</p>
              )}
            </div>

            {s.look.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Slides to look at</h3>
                <ul className="flex flex-col gap-3">
                  {s.look.map((l, i) => (
                    <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                      <span className="shrink-0 font-mono text-sm font-medium text-primary sm:w-36" title={l.source}>
                        {l.ref}
                      </span>
                      <span className="text-base">{l.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>

      <footer className="flex flex-col gap-6 break-inside-avoid">
        <div className="flex items-start gap-3 rounded-lg bg-muted px-4 py-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold">{DOC_TEXT.boundary}</p>
            <p className="text-sm text-muted-foreground">{DOC_TEXT.boundaryDetail}</p>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">{DOC_TEXT.footer}</p>
      </footer>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-base font-semibold">{value}</dd>
    </div>
  );
}
