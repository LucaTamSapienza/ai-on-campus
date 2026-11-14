"use client";

// Elenco delle fonti del corso con stato e conteggi.
import { AlertCircle, Check, Clock, Loader2 } from "lucide-react";
import type { Source, SourceStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS: Record<SourceStatus, { label: string; icon: typeof Check; className: string }> = {
  queued: { label: "Queued", icon: Clock, className: "text-muted-foreground" },
  processing: { label: "Reading", icon: Loader2, className: "text-accent-strong [&>svg]:animate-spin" },
  done: { label: "Read", icon: Check, className: "text-success" },
  error: { label: "Reading failed", icon: AlertCircle, className: "text-destructive" },
};

export function SourceList({ sources }: { sources: Source[] | null }) {
  if (!sources)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-(--row-height) w-full" />
        ))}
      </div>
    );
  if (sources.length === 0) return <p className="text-base text-muted-foreground">No sources yet. Upload the first lesson above.</p>;
  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-card">
      {[...sources].reverse().map((s) => {
        const st = STATUS[s.status];
        return (
          <li key={s.id} className="flex min-h-(--row-height) items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium break-words">{s.title}</p>
              <p className="text-sm text-muted-foreground">
                {s.passageCount} passages · {s.conceptCount} concepts
                {s.thinCount > 0 && ` · ${s.thinCount} without extracted text`}
                {s.kind === "transcript" && " · transcript"}
              </p>
              {s.error && <p className={cn("mt-1 text-sm", s.status === "error" ? "text-destructive" : "text-muted-foreground")}>{s.error}</p>}
            </div>
            <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm font-medium", st.className)}>
              <st.icon className="size-4" aria-hidden />
              {st.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
