"use client";

// Elenco delle domande dell'esame con l'ultimo esito, e il modulo per una domanda nuova.
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { esameApi, type ExamQuestion, type RubricInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VerdictBadge } from "./shared";
import { toastError } from "@/components/ui/sonner";

export function QuestionList({ questions, onNew }: { questions: ExamQuestion[]; onNew: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {questions.map((q) => (
          <li key={q.id}>
            <Link
              href={`/exam?q=${q.id}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Question {q.ordinal} · version {q.version.version}
                </p>
                <p className="line-clamp-3 text-base">{q.version.text}</p>
                <div className="flex flex-wrap gap-2">
                  {!q.lastRun ? (
                    <span className="text-sm text-muted-foreground">Not attacked yet</span>
                  ) : q.lastRun.status === "running" ? (
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <Loader2 className="size-4 animate-spin text-accent" aria-hidden /> Attack in progress
                    </span>
                  ) : !q.lastRun.onCurrentVersion ? (
                    <span className="text-sm text-muted-foreground">New version to attack</span>
                  ) : (
                    q.lastRun.verdicts.map((v, i) => <VerdictBadge key={i} kind={v.kind} title={v.title} />)
                  )}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <Button onClick={onNew} className="self-stretch sm:self-start">
        <Plus aria-hidden /> New question
      </Button>
    </div>
  );
}

type Row = { criterion: string; points: string; expected: string };
const emptyRow = (): Row => ({ criterion: "", points: "", expected: "" });

export function QuestionForm({ examId, onCreated, onCancel }: { examId: () => Promise<string>; onCreated: (id: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [busy, setBusy] = useState(false);

  const rubric: RubricInput[] = rows
    .filter((r) => r.criterion.trim() && Number(r.points.replace(",", ".")) > 0)
    .map((r) => ({ criterion: r.criterion.trim(), points: Number(r.points.replace(",", ".")), ...(r.expected.trim() ? { expected: r.expected.trim() } : {}) }));
  const total = rubric.reduce((s, r) => s + r.points, 0);
  const ready = text.trim().length >= 10 && rubric.length > 0;

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await esameApi.createQuestion(await examId(), { text: text.trim(), rubric });
      onCreated(id);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Question not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="testo" className="text-base font-semibold">
          Question text
        </label>
        <Textarea id="testo" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} className="min-h-32 text-base" />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold">Grading rubric · {total ? `${total} points` : "required"}</legend>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex gap-2">
              <Input aria-label={`Criterion ${i + 1}`} placeholder="Criterion" value={r.criterion} onChange={(e) => set(i, { criterion: e.target.value })} maxLength={300} className="h-11 flex-1 text-base" />
              <Input aria-label={`Points for criterion ${i + 1}`} placeholder="Points" inputMode="decimal" value={r.points} onChange={(e) => set(i, { points: e.target.value })} className="h-11 w-20 text-base" />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove criterion ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} disabled={rows.length === 1}>
                <Trash2 aria-hidden />
              </Button>
            </div>
            <Input aria-label={`What earns the points, criterion ${i + 1}`} placeholder="What earns the points (optional)" value={r.expected} onChange={(e) => set(i, { expected: e.target.value })} maxLength={600} className="h-11 text-base" />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])} disabled={rows.length >= 12} className="self-start">
          <Plus aria-hidden /> Add a criterion
        </Button>
      </fieldset>

      {/* Il motivo per cui «Salva» è spento sta subito sopra il pulsante, visibile anche su telefono. */}
      {!rubric.length && text.trim().length >= 10 && <p className="text-sm text-muted-foreground">Add a grading rubric. Without a rubric there is nothing to grade or attack.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={!ready || busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save question
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
