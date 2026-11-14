"use client";

// La scheda del Revisore: verdetti calcolati dal backend con la prova accanto, proposta di
// riscrittura modificabile, decisione del docente. Solo il docente crea una nuova versione.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, esameApi, type CavillatoreFinding, type DecisionAction, type LetteraleFinding, type RunDetail, type Verdict } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmt, PassageRef, VerdictBadge } from "./shared";
import { toastError } from "@/components/ui/sonner";

type Props = {
  run: RunDetail;
  currentVersionId: string | null;
  decided: DecisionAction | null;
  onNewRun: (runId: string) => void;
  onChanged: () => void;
};

export function Scheda({ run, currentVersionId, decided, onNewRun, onChanged }: Props) {
  const review = run.review!;
  const proposal = review.proposedText ?? "";
  // Il corso non copre la domanda: il server non manda una riscrittura e non accetta di approvarla.
  const notCovered = !proposal && review.verdicts.some((v) => v.kind === "prove_insufficienti");
  const [text, setText] = useState(proposal || run.version.text);
  const [busy, setBusy] = useState<DecisionAction | null>(null);
  const edited = text.trim() !== (proposal || run.version.text).trim();
  const stale = currentVersionId !== run.version.id;
  const locked = stale || !!decided || run.status === "running";

  async function decide(action: DecisionAction) {
    setBusy(action);
    try {
      await esameApi.decide(run.questionId, {
        reviewId: review.id,
        expectedVersionId: run.version.id,
        action,
        ...(action === "modificata" ? { text: text.trim() } : {}),
      });
      if (action === "tenuta") {
        toast.success("Question kept as it is. Decision recorded.");
        onChanged();
        return;
      }
      const { runId } = await esameApi.attack(run.questionId);
      toast.success(`Version ${run.version.version + 1} saved. Attacking again.`);
      onNewRun(runId);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "Could not record the decision. Try again.");
      if (e instanceof ApiError && e.status === 409) onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Reviewer's report" className="flex flex-col gap-6 rounded-lg border bg-card p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Report</h2>
        <p className="text-sm text-muted-foreground">Verdicts computed from the scores, with the evidence alongside. The Reviewer proposes the rewrite, the teacher decides.</p>
      </div>

      <ul className="flex flex-col gap-4">
        {review.verdicts.map((v, i) => (
          <li key={i} className="flex flex-col gap-3">
            <VerdictBadge kind={v.kind} title={v.title} className="self-start" />
            <p className="text-base">{v.detail}</p>
            <Evidence verdict={v} run={run} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t pt-6">
        <label htmlFor="proposta" className="text-base font-semibold">
          {proposal
            ? "Proposed rewrite"
            : notCovered
              ? "Not covered by the course materials: no rewrite proposed"
              : "The Reviewer proposes no changes"}
        </label>
        {review.rationale && <p className="text-sm text-muted-foreground">{review.rationale}</p>}
        {review.error && <p className="text-sm text-destructive">Reviewer: {review.error}</p>}
        <Textarea
          id="proposta"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={locked}
          rows={6}
          className="min-h-36 text-base"
          maxLength={4000}
        />
        <p className="text-sm text-muted-foreground">The rubric stays yours. Before and after are compared on the same criteria.</p>
        {locked ? (
          <p className="text-sm text-muted-foreground">
            {decided === "tenuta"
              ? "You kept the question as it is."
              : decided
                ? "Decision made. The new version is the current one."
                : stale
                  ? "This report covers an earlier version."
                  : "Attack in progress."}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(proposal || notCovered) && (
              <Button onClick={() => decide("approvata")} disabled={!!busy || edited || notCovered} variant={edited || notCovered ? "outline" : "default"}>
                {busy === "approvata" && <Loader2 className="animate-spin" aria-hidden />}
                Approve and attack again
              </Button>
            )}
            <Button onClick={() => decide("modificata")} disabled={!!busy || !edited || text.trim().length < 10} variant={edited || !proposal ? "default" : "outline"}>
              {busy === "modificata" && <Loader2 className="animate-spin" aria-hidden />}
              Edit and attack again
            </Button>
            <Button onClick={() => decide("tenuta")} disabled={!!busy} variant="ghost">
              {busy === "tenuta" && <Loader2 className="animate-spin" aria-hidden />}
              Keep as is
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Evidence({ verdict, run }: { verdict: Verdict; run: RunDetail }) {
  const get = (agent: string) => run.attacks.find((a) => a.agent === agent);
  if (verdict.kind === "supera_soglia") {
    const a = get("esterno");
    return a?.answer ? (
      <blockquote className="rounded-lg border-l-4 border-destructive bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
        <span className="mb-1 block text-xs text-muted-foreground">
          Outsider&apos;s answer ({verdict.model}): {fmt(verdict.total!)}/{fmt(verdict.max!)}, pass mark {fmt(verdict.threshold!)}
        </span>
        {a.answer}
      </blockquote>
    ) : null;
  }
  if (verdict.kind === "ambiguita") {
    const a = get("cavillatore");
    const f = a?.finding as CavillatoreFinding | null;
    if (!a || !f?.found) return null;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {f.readings.map((r, i) => {
          const g = a.grades.find((x) => x.readingIndex === i);
          return (
            <div key={i} className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Reading {i + 1}
                {g && g.total !== null ? `: ${fmt(g.total)}/${fmt(g.max)}` : ""}
              </p>
              <p className="text-sm">{r.interpretation}</p>
            </div>
          );
        })}
      </div>
    );
  }
  if (verdict.kind === "prove_insufficienti") {
    const n = run.retrieval?.passages.length ?? 0;
    return <p className="text-sm text-muted-foreground">Passages retrieved: {n}. The retrieval path is above.</p>;
  }
  if (verdict.kind === "nessun_controesempio") {
    const f = get("letterale")?.finding as LetteraleFinding | null;
    const byId = new Map(run.retrieval?.passages.map((p) => [p.id, p]) ?? []);
    const first = f?.citations[0];
    const p = first ? byId.get(first.passageId) : undefined;
    return p && first ? <PassageRef passage={p} quote={first.quote} /> : null;
  }
  return null;
}
