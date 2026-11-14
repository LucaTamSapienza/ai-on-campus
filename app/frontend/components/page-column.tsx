// Colonna delle pagine a elenco: una colonna con margine 16 px su telefono, centrata fino a 880 px su desktop.
export function PageColumn({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-(--column-width) flex-col gap-6 px-4 py-6 lg:px-8 lg:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold lg:text-title">{title}</h1>
          {description && <p className="max-w-(--measure) text-base text-muted-foreground">{description}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
