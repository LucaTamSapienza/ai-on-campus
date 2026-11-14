"use client";

// Un'esecuzione del triplo attacco: stato dal vivo dal coordinatore via WebSocket (testo che arriva,
// chi lavora) e dati veri da GET /api/runs/:id, riletti quando il coordinatore scrive in D1.
// Se il WebSocket non c'è, si rilegge ogni 2 secondi; se c'è, ogni 5 per sicurezza.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { AGENT_HOST, agentQuery, esameApi, type AttaccoState, type RunDetail } from "@/lib/api";

export function useRun(runId: string) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [live, setLive] = useState<AttaccoState | null>(null);
  const [socketOpen, setSocketOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le riletture possono tornare in disordine: vale solo la più recente.
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await esameApi.run(runId);
      if (mine !== seq.current) return;
      setRun(next);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : "Unable to reach the server. Check the connection and try again.");
    }
  }, [runId]);

  const query = useMemo(() => agentQuery(), []);

  useAgent<AttaccoState>({
    agent: "attacco",
    name: runId,
    host: AGENT_HOST,
    query,
    onStateUpdate: (state) => setLive(state),
    onOpen: () => setSocketOpen(true),
    onClose: () => setSocketOpen(false),
  });

  // Ogni scrittura del coordinatore in D1 fa crescere version: si rilegge.
  const liveVersion = live?.version ?? 0;
  useEffect(() => {
    refresh();
  }, [refresh, liveVersion]);

  // Ripiego: senza WebSocket si rilegge ogni 2 secondi finché l'esecuzione è aperta.
  const running = !run || run.status === "running";
  // Con il WebSocket aperto resta una rilettura lenta di sicurezza, se un aggiornamento va perso.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, socketOpen ? 5000 : 2000);
    return () => clearInterval(t);
  }, [socketOpen, running, refresh]);

  // Il testo dal vivo vale solo per l'esecuzione giusta.
  const liveState = live && live.runId === runId ? live : null;
  return { run, live: liveState, socketOpen, error, refresh };
}
