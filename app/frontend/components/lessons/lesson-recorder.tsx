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
      toast.error("The microphone is unavailable or permission was denied.");
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
        setTitle(`Lesson recorded on ${new Date().toLocaleDateString("en-GB")}`);
        setPhase({ kind: "review", text: r.text, seconds: r.seconds, cost: r.costUsd });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Transcription failed.");
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
      const r = await api.createSource(courseId, { title: title.trim() || "Recorded lesson", kind: "transcript", text: phase.text });
      await lezioniApi.setDone(r.sourceId, true);
      toast.success("Transcript sent to the Cartographer.");
      setPhase({ kind: "idle" });
      onAdded();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add the transcript.");
    } finally {
      setSending(false);
    }
  };

  const elapsed = phase.kind === "recording" ? Math.min(MAX_SECONDS, (now - phase.since) / 1000) : 0;

  return (
    <section aria-label="Record a lesson" className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Record a lesson</h2>
        <p className="text-sm text-muted-foreground">
          Up to 3 minutes from the microphone. The audio is not kept. Only the transcript stays, and you review it before sending it to the
          Cartographer.
        </p>
      </div>

      {phase.kind === "idle" && (
        <Button onClick={start} className="lg:self-start">
          <Mic aria-hidden /> Record
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
            <Square aria-hidden /> Stop and transcribe
          </Button>
        </div>
      )}

      {phase.kind === "transcribing" && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">Transcribing the recording…</p>
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {phase.kind === "review" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {phase.seconds} seconds transcribed{phase.cost !== null ? ` · $${phase.cost.toFixed(4)}` : ""}
          </p>
          <p className="max-h-64 overflow-y-auto rounded-lg border bg-background p-3 text-base whitespace-pre-line">{phase.text}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Source title
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <div className="flex flex-col gap-2 lg:flex-row">
            <Button onClick={send} disabled={sending}>
              Send to the Cartographer
            </Button>
            <Button variant="outline" onClick={() => setPhase({ kind: "idle" })} disabled={sending}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
