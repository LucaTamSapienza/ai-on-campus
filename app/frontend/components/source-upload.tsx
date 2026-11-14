"use client";

// Caricamento di una fonte: file di testo o Markdown, oppure testo incollato. Una sola azione.
import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MAX_CHARS = 300_000;
const ACCEPT = ".md,.markdown,.txt,text/plain,text/markdown";

export function SourceUpload({ courseId, onUploaded }: { courseId: string; onUploaded: () => void }) {
  const [mode, setMode] = useState("file");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast.error("Solo file di testo o Markdown (.md, .txt).");
      return;
    }
    const content = await file.text();
    if (content.length > MAX_CHARS) {
      toast.error("Il file supera i 300.000 caratteri. Dividilo in più fonti.");
      return;
    }
    setText(content);
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.(md|markdown|txt)$/i, ""));
  };

  const reset = () => {
    setTitle("");
    setText("");
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api.createSource(courseId, { title: title.trim(), text });
          if (r.duplicate) toast.info("Questa fonte è già nel corso: niente doppioni.");
          else toast.success("Fonte caricata: il Cartografo la sta leggendo.");
          reset();
          onUploaded();
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Caricamento non riuscito.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="w-full lg:w-fit">
          <TabsTrigger value="file" className="min-h-10 flex-1 lg:flex-none">
            File
          </TabsTrigger>
          <TabsTrigger value="testo" className="min-h-10 flex-1 lg:flex-none">
            Testo incollato
          </TabsTrigger>
        </TabsList>
        <TabsContent value="file" className="pt-2">
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-150 ease-out hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50">
            <FileUp className="size-6 text-muted-foreground" aria-hidden />
            <span className="text-base font-medium">{fileName ?? "Scegli un file .md o .txt"}</span>
            <span className="text-sm text-muted-foreground">
              {fileName ? `${text.length.toLocaleString("it-IT")} caratteri` : "Slide esportate in testo o trascrizioni, fino a 300.000 caratteri"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            />
          </label>
        </TabsContent>
        <TabsContent value="testo" className="pt-2">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, MAX_CHARS));
              setFileName(null);
            }}
            rows={8}
            placeholder="Incolla qui il testo della lezione"
            aria-label="Testo della lezione"
            className="text-base"
          />
        </TabsContent>
      </Tabs>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Titolo
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Per esempio L08 Q-learning e SARSA" />
      </label>
      <Button type="submit" disabled={busy || !title.trim() || !text.trim()} className="lg:self-start">
        {busy ? "Carico…" : "Carica e fai leggere al Cartografo"}
      </Button>
    </form>
  );
}
