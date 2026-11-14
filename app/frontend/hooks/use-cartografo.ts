"use client";

// Stato del Cartografo in tempo reale via WebSocket (Cloudflare Agents SDK), in sola lettura.
import { useState } from "react";
import { useAgent } from "agents/react";
import { AGENT_HOST, agentQuery, type CartografoState } from "@/lib/api";

export function useCartografo(courseId: string): CartografoState | null {
  const [state, setState] = useState<CartografoState | null>(null);
  useAgent<CartografoState>({
    agent: "cartografo",
    name: courseId,
    host: AGENT_HOST,
    // Il WebSocket non porta intestazioni: token di sessione e codice demo viaggiano come parametri.
    query: agentQuery(),
    onStateUpdate: (s) => setState(s),
  });
  return state;
}
