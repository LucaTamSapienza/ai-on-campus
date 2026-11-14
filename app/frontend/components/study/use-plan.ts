"use client";

// Un piano di studio: stato dal vivo del Pianificatore via WebSocket (quale sessione scrive, il
// testo che arriva) e dati veri da GET /api/study-plans/:id, riletti quando l'agente scrive in D1.
// Senza WebSocket si rilegge ogni 2 secondi, con il WebSocket ogni 5 per sicurezza.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { AGENT_HOST, apiRole, demoCode, studioApi, type PianificatoreState, type StudyPlan } from "@/lib/api";

export function usePlan(planId: string) {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [live, setLive] = useState<PianificatoreState | null>(null);
  const [socketOpen, setSocketOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await studioApi.plan(planId);
      if (mine !== seq.current) return;
      setPlan(next);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : "Error");
    }
  }, [planId]);

  const query = useMemo(() => {
    const q: Record<string, string> = {};
    const code = demoCode();
    if (code) q.code = code;
    const role = apiRole();
    if (role) q.role = role;
    return q;
  }, []);

  useAgent<PianificatoreState>({
    agent: "pianificatore",
    name: planId,
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

  const running = !plan || plan.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, socketOpen ? 5000 : 2000);
    return () => clearInterval(t);
  }, [socketOpen, running, refresh]);

  return { plan, live: live && live.planId === planId ? live : null, error };
}
