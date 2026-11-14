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
      toast.error("Only text or Markdown files (.md, .txt).");
      return;
    }
    const content = await file.text();
    if (content.length > MAX_CHARS) {
      toast.error("The file exceeds 300,000 characters. Split it into several sources.");
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
          if (r.duplicate) toast.info("This source is already in the course. No duplicates.");
          else toast.success("Source uploaded. The Cartographer is reading it.");
          reset();
          onUploaded();
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Upload failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="w-full lg:w-fit">
          <TabsTrigger value="file" className="min-h-11 flex-1 lg:flex-none lg:px-4">
            File
          </TabsTrigger>
          <TabsTrigger value="testo" className="min-h-11 flex-1 lg:flex-none lg:px-4">
            Pasted text
          </TabsTrigger>
        </TabsList>
        <TabsContent value="file" className="pt-2">
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-150 ease-out hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50">
            <FileUp className="size-6 text-muted-foreground" aria-hidden />
            <span className="text-base font-medium">{fileName ?? "Choose a .md or .txt file"}</span>
            <span className="text-sm text-muted-foreground">
              {fileName ? `${text.length.toLocaleString("en-US")} characters` : "Slides exported as text, or transcripts, up to 300,000 characters"}
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
            placeholder="Paste the lesson text here"
            aria-label="Lesson text"
            className="text-base"
          />
        </TabsContent>
      </Tabs>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Title
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="For example L08 Q-learning" />
      </label>
      <Button type="submit" disabled={busy || !title.trim() || !text.trim()} className="lg:self-start">
        {busy ? "Uploading…" : "Upload and send to the Cartographer"}
      </Button>
    </form>
  );
}
