"use client";

// Il riepilogo della classe, calcolato dal backend sui voti del Correttore: distribuzione dei
// voti, criteri dove si perdono punti, lezioni e concetti mancanti che spiegano gli errori.
import type { ClassSummary as Summary, Gap } from "@/lib/api";
import { shortSource } from "@/lib/graph-style";
import { fmt } from "@/components/exam/shared";

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n)}%`);

export function ClassSummary({ summary, total }: { summary: Summary; total: number }) {
  const top = Math.max(1, ...summary.bands.map((b) => b.count));
  // Solo ciò che separa davvero i voti: chi non l'ha seguito prende meno di chi sì.
  const lessons = summary.lessons.filter(separates).slice(0, 4);
  const gaps = summary.gaps.filter(separates).slice(0, 6);
  return (
    <section aria-label="Class summary" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Score distribution</h2>
          <span className="text-sm text-muted-foreground">
            {summary.graded} of {total} graded
          </span>
        </div>
        <p className="text-base">
          Average <span className="font-semibold tabular-nums">{summary.mean === null ? "–" : fmt(Math.round(summary.mean * 10) / 10)}</span> out of{" "}
          {fmt(summary.max)}
        </p>
        <ul className="flex flex-col gap-2">
          {summary.bands.map((b) => (
            <li key={b.label} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary transition-[width] duration-250 ease-out" style={{ width: `${(b.count / top) * 100}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums">{b.count}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Average points per criterion</h3>
          <ul className="flex flex-col gap-1.5">
            {summary.criteria.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">{c.criterion}</span>
                <span className="shrink-0 tabular-nums">
                  {fmt(Math.round(c.avg * 10) / 10)}/{fmt(c.max)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">What explains the lost points</h2>
        {lessons.length === 0 && gaps.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No missing lesson or concept separates the scores. Students who missed them score like the others.
          </p>
        ) : (
          <>
            {lessons.length > 0 && (
              <GapList
                title="Lessons the question's passages come from"
                items={lessons.map((l) => ({ key: l.id, label: shortSource(l.title), mono: true, gap: l }))}
              />
            )}
            {gaps.length > 0 && (
              <GapList title="Graph concepts missing from the notes" items={gaps.map((g) => ({ key: g.id, label: g.name, gap: g }))} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function separates(g: Gap) {
  return g.avgMissing !== null && g.avgFollowed !== null && g.avgFollowed - g.avgMissing >= 10;
}

function GapList({ title, items }: { title: string; items: { key: string; label: string; mono?: boolean; gap: Gap }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col divide-y rounded-lg border">
        {items.map(({ key, label, mono, gap }) => (
          <li key={key} className="flex flex-col gap-0.5 px-3 py-2">
            <span className={mono ? "font-mono text-sm font-medium" : "text-sm font-medium"}>{label}</span>
            <span className="text-sm text-muted-foreground">
              {gap.missingCount === 1 ? "1 student lacked it" : `${gap.missingCount} students lacked it`}: {pct(gap.avgMissing)} of the points, against{" "}
              {pct(gap.avgFollowed)} for those who had it
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
