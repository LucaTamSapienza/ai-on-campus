// Pallino del colore di un argomento: il colore non è mai l'unico segnale, il nome è scritto accanto.
import { topicDotClass } from "@/lib/graph-style";
import { cn } from "@/lib/utils";

export function TopicDot({ slot, className }: { slot: number | null; className?: string }) {
  return <span className={cn("size-2.5 shrink-0 rounded-full", topicDotClass(slot), className)} aria-hidden />;
}
