"use client";

// Registra una lezione: il microfono si chiede solo al clic, al massimo 3 minuti. L'audio va al
// Worker, che lo fa trascrivere e non lo conserva; il docente rilegge la trascrizione e la manda al
// Cartografo dalla stessa rotta delle fonti (kind = transcript).
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, lezioniApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toWavBase64 } from "./wav";

const MAX_SECONDS = 180;

type Phase = { kind: "idle" } | { kind: "recording"; since: number } | { kind: "transcribing" } | { kind: "review"; text: string; seconds: number; cost: number | null };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function LessonRecorder({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(0);
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase.kind !== "recording") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase.kind]);

  // Uscendo dalla pagina il microfono si spegne.
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Il microfono non è disponibile o il permesso è stato negato.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (stopTimer.current) clearTimeout(stopTimer.current);
      setPhase({ kind: "transcribing" });
      try {
        const { base64 } = await toWavBase64(new Blob(chunks, { type: rec.mimeType }));
        const r = await lezioniApi.transcribe(courseId, base64);
        setTitle(`Lezione registrata del ${new Date().toLocaleDateString("it-IT")}`);
        setPhase({ kind: "review", text: r.text, seconds: r.seconds, cost: r.costUsd });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "La trascrizione non è riuscita.");
        setPhase({ kind: "idle" });
      }
    };
    recorder.current = rec;
    rec.start(1000);
    setNow(Date.now());
    setPhase({ kind: "recording", since: Date.now() });
    stopTimer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
  };

  const send = async () => {
    if (phase.kind !== "review") return;
    setSending(true);
    try {
      const r = await api.createSource(courseId, { title: title.trim() || "Lezione registrata", kind: "transcript", text: phase.text });
      await lezioniApi.setDone(r.sourceId, true);
      toast.success("Trascrizione mandata al Cartografo.");
      setPhase({ kind: "idle" });
      onAdded();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Non è stato possibile aggiungere la trascrizione.");
    } finally {
      setSending(false);
    }
  };

  const elapsed = phase.kind === "recording" ? Math.min(MAX_SECONDS, (now - phase.since) / 1000) : 0;

  return (
    <section aria-label="Registra una lezione" className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Registra una lezione</h2>
        <p className="text-sm text-muted-foreground">
          Fino a 3 minuti dal microfono. L&apos;audio non si conserva: resta la trascrizione, che rileggi prima di mandarla al Cartografo.
        </p>
      </div>

      {phase.kind === "idle" && (
        <Button onClick={start} className="lg:self-start">
          <Mic aria-hidden /> Registra
        </Button>
      )}

      {phase.kind === "recording" && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <p className="flex items-center gap-2 text-base" aria-live="polite">
            <span className="size-3 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden />
            <span className="font-mono tabular-nums">
              {clock(elapsed)} / {clock(MAX_SECONDS)}
            </span>
          </p>
          <Button variant="outline" onClick={() => recorder.current?.stop()} className="lg:ml-auto">
            <Square aria-hidden /> Ferma e trascrivi
          </Button>
        </div>
      )}

      {phase.kind === "transcribing" && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">Trascrive la registrazione…</p>
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {phase.kind === "review" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {phase.seconds} secondi trascritti{phase.cost !== null ? ` · ${phase.cost.toFixed(4).replace(".", ",")} $` : ""}
          </p>
          <p className="max-h-64 overflow-y-auto rounded-lg border bg-background p-3 text-base whitespace-pre-line">{phase.text}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Titolo della fonte
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <div className="flex flex-col gap-2 lg:flex-row">
            <Button onClick={send} disabled={sending}>
              Manda al Cartografo
            </Button>
            <Button variant="outline" onClick={() => setPhase({ kind: "idle" })} disabled={sending}>
              Scarta
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
