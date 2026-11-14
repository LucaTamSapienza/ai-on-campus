// Stato vuoto con una sola azione.
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <Icon className="size-10 text-muted-foreground" aria-hidden />
      <div className="flex max-w-sm flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-base text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
