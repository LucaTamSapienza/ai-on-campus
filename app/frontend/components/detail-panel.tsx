"use client";

// Dettaglio di un concetto: pannello a destra su desktop, foglio dal basso su telefono, stesso contenuto.
import { useEffect, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, type ConceptDetail, type RelationType } from "@/lib/api";
import { RELATION_LABELS } from "@/lib/graph-style";
import { useIsDesktop } from "@/hooks/use-media-query";
import type { Role } from "@/components/app-shell";
import { SourceRef } from "@/components/source-ref";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  conceptId: string | null;
  role: Role;
  colorOf: (topicId: string | null) => string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onChanged: () => void;
};

const SNAPS = [0.5, 1];

export function DetailPanel(props: Props) {
  const isDesktop = useIsDesktop();
  const [snap, setSnap] = useState<number | string | null>(SNAPS[0]);
  useEffect(() => {
    if (props.conceptId) setSnap(SNAPS[0]);
  }, [props.conceptId]);

  if (isDesktop) {
    if (!props.conceptId) return null;
    return (
      <aside
        className="relative flex w-[400px] shrink-0 flex-col border-l bg-card animate-in duration-250 ease-out slide-in-from-right-8 fade-in-0"
        aria-label="Dettaglio del concetto"
      >
        <DetailBody {...props} />
      </aside>
    );
  }

  return (
    <DrawerPrimitive.Root
      open={!!props.conceptId}
      onOpenChange={(o) => !o && props.onClose()}
      snapPoints={SNAPS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(100dvh-72px)] flex-col rounded-t-2xl border-t bg-card shadow-float outline-none"
        >
          <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden />
          <DetailBody {...props} titleAs={DrawerPrimitive.Title} scrollable={snap === 1} />
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

function DetailBody({
  conceptId,
  role,
  colorOf,
  onClose,
  onSelect,
  onChanged,
  titleAs: Title = "h2",
  scrollable = true,
}: Props & { titleAs?: React.ElementType; scrollable?: boolean }) {
  const [detail, setDetail] = useState<ConceptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!conceptId) return;
    let alive = true;
    setEditing(false);
    setError(null);
    api
      .concept(conceptId)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Errore"));
    return () => {
      alive = false;
    };
  }, [conceptId]);

  const current = detail && detail.concept.id === conceptId ? detail : null;
  const groups = groupRelations(current?.relations ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 px-6 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          {current ? (
            <Title className="text-2xl font-bold break-words">{current.concept.name}</Title>
          ) : (
            <>
              <Title className="sr-only">Concetto</Title>
              <Skeleton className="h-8 w-2/3" />
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi il dettaglio">
          <X className="size-5" />
        </Button>
      </div>

      <div className={scrollable ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8" : "min-h-0 flex-1 overflow-hidden px-6 pb-8"}>
        {error && <p className="text-base text-destructive">{error}</p>}
        {!current && !error && <DetailSkeleton />}
        {current && editing && (
          <EditForm
            detail={current}
            onCancel={() => setEditing(false)}
            onSaved={(d) => {
              setDetail(d);
              setEditing(false);
              onChanged();
            }}
          />
        )}
        {current && !editing && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 font-medium">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: colorOf(current.concept.topicId) }} aria-hidden />
                {current.concept.topicName ?? "Senza argomento"}
              </span>
              <span className="rounded-full border px-3 py-1 text-muted-foreground">{current.concept.kind}</span>
            </div>

            <p className="text-base">{current.concept.definition || "Nessuna definizione."}</p>

            {groups.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Relazioni</h3>
                {groups.map((g) => (
                  <div key={g.label} className="flex flex-col gap-1.5">
                    <p className="text-sm">{g.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((r) => (
                        <button
                          key={r.id + r.direction}
                          type="button"
                          onClick={() => onSelect(r.otherId)}
                          title={r.note}
                          className="min-h-11 rounded-lg border bg-card px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {r.otherName}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Da dove viene ({current.passages.length})</h3>
              {current.passages.map((p) => (
                <SourceRef key={p.id} sourceTitle={p.sourceTitle} locator={p.locator} text={p.text} role={p.role} />
              ))}
            </section>

            {role === "docente" && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Correggi
                </Button>
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Elimina il concetto
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminare «{current?.concept.name}»?</DialogTitle>
            <DialogDescription>Il concetto sparisce dal grafo insieme alle sue relazioni. Le fonti restano.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!current) return;
                try {
                  await api.deleteConcept(current.concept.id);
                  setConfirmDelete(false);
                  toast.success("Concetto eliminato.");
                  onClose();
                  onChanged();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Non è stato possibile eliminare il concetto.");
                }
              }}
            >
              Elimina il concetto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({ detail, onCancel, onSaved }: { detail: ConceptDetail; onCancel: () => void; onSaved: (d: ConceptDetail) => void }) {
  const [name, setName] = useState(detail.concept.name);
  const [definition, setDefinition] = useState(detail.concept.definition);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const r = await api.updateConcept(detail.concept.id, { name: name.trim(), definition: definition.trim() });
          onSaved({ ...detail, concept: { ...detail.concept, name: r.name, definition: r.definition } });
          toast.success("Concetto corretto.");
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Non è stato possibile salvare.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Definizione
        <Textarea value={definition} onChange={(e) => setDefinition(e.target.value)} maxLength={800} rows={6} className="text-base" />
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !name.trim()}>
          Salva
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-48 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

const ORDER: RelationType[] = ["prerequisito", "parte_di", "generalizza", "usa", "contrasta"];

function groupRelations(relations: ConceptDetail["relations"]) {
  const groups = new Map<string, ConceptDetail["relations"]>();
  const sorted = [...relations].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.direction === "in" ? -1 : 1));
  for (const r of sorted) {
    const label = RELATION_LABELS[r.type][r.direction];
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}
