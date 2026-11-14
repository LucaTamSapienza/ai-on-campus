"use client";

// Materiali del corso: caricamento delle fonti e il loro stato, con il Cartografo dal vivo.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Source } from "@/lib/api";
import { useCartografo } from "@/hooks/use-cartografo";
import { useShell } from "@/components/app-shell";
import { AgentStrip } from "@/components/agent-strip";
import { PageColumn } from "@/components/page-column";
import { SourceList } from "@/components/source-list";
import { SourceUpload } from "@/components/source-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function MaterialsPage() {
  const { course, courseLoading, courseError } = useShell();
  return (
    <PageColumn
      title="Materials"
      description="Course slides and transcripts. The Cartographer reads each source and adds its concepts to the graph."
    >
      {courseLoading && <Skeleton className="h-64 w-full" />}
      {courseError && <p className="text-base text-destructive">{courseError}</p>}
      {!courseLoading && !courseError && !course && <CreateCourse />}
      {course && <CourseMaterials courseId={course.id} />}
    </PageColumn>
  );
}

function CourseMaterials({ courseId }: { courseId: string }) {
  // blocco 2: con ruolo studente i materiali si leggono soltanto
  const { role } = useShell();
  const cartografo = useCartografo(courseId);
  const [sources, setSources] = useState<Source[] | null>(null);
  const load = useCallback(() => {
    api.sources(courseId).then(setSources).catch(() => setSources((s) => s ?? []));
  }, [courseId]);
  const version = cartografo?.graphRevision;
  const status = cartografo?.status;
  useEffect(() => {
    load();
  }, [load, version, status]);

  return (
    <>
      {role === "docente" && <SourceUpload courseId={courseId} onUploaded={load} />}
      <AgentStrip state={cartografo} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sources {sources ? `(${sources.length})` : ""}</h2>
        <SourceList sources={sources} />
      </section>
    </>
  );
}

function CreateCourse() {
  const { reloadCourse } = useShell();
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.createCourse(name.trim());
          await reloadCourse();
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not create the course.");
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Course name
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="For example Reinforcement Learning" />
      </label>
      <Button type="submit" disabled={!name.trim()} className="lg:self-start">
        Create course
      </Button>
    </form>
  );
}
