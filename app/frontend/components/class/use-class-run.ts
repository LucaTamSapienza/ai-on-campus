"use client";

// Un'esecuzione della classe simulata: stato dal vivo dal coordinatore via WebSocket (chi scrive,
// il testo che arriva) e dati veri da GET /api/class-runs/:id, riletti quando il coordinatore
// scrive in D1. Senza WebSocket si rilegge ogni 2 secondi, con il WebSocket ogni 5 per sicurezza.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { AGENT_HOST, apiRole, classeApi, demoCode, type ClasseState, type ClassRunDetail } from "@/lib/api";

export function useClassRun(runId: string) {
  const [run, setRun] = useState<ClassRunDetail | null>(null);
  const [live, setLive] = useState<ClasseState | null>(null);
  const [socketOpen, setSocketOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await classeApi.run(runId);
      if (mine !== seq.current) return;
      setRun(next);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : "Error");
    }
  }, [runId]);

  const query = useMemo(() => {
    const q: Record<string, string> = {};
    const code = demoCode();
    if (code) q.code = code;
    const role = apiRole();
    if (role) q.role = role;
    return q;
  }, []);

  useAgent<ClasseState>({
    agent: "classe",
    name: runId,
    host: AGENT_HOST,
    query,
    onStateUpdate: (state) => setLive(state),
    onOpen: () => setSocketOpen(true),
    onClose: () => setSocketOpen(false),
  });

  const liveVersion = live?.version ?? 0;
  useEffect(() => {
    refresh();
  }, [refresh, liveVersion]);

  const running = !run || run.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, socketOpen ? 5000 : 2000);
    return () => clearInterval(t);
  }, [socketOpen, running, refresh]);

  const liveState = live && live.runId === runId ? live : null;
  return { run, live: liveState, error };
}
