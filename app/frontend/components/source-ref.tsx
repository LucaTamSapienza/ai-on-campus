"use client";

// Citazione di un passaggio: fonte, posizione, testo espandibile. Il testo resta testo, mai HTML.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { shortSource } from "@/lib/graph-style";
import { cn } from "@/lib/utils";

export function SourceRef({ sourceTitle, locator, text, role }: { sourceTitle: string; locator: string; text: string; role?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span className="font-mono text-sm font-medium" title={sourceTitle}>
          {shortSource(sourceTitle)} · {locator}
        </span>
        {role && <span className="text-xs text-muted-foreground">{role}</span>}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      <p className={cn("px-3 pb-3 text-sm whitespace-pre-line text-muted-foreground", !open && "line-clamp-3")}>{text}</p>
    </div>
  );
}
