// Colori e testi del grafo, dai token di docs/design-system.md. Il canvas non legge le classi
// Tailwind, quindi i valori stanno qui e non nelle pagine.
import type { RelationType } from "@/lib/api";

export const TOPIC_COLORS = [
  "#2563EB", "#0D9488", "#9333EA", "#DB2777", "#CA8A04", "#0891B2",
  "#65A30D", "#DC2626", "#4F46E5", "#B45309", "#059669", "#7C3AED",
];
export const NO_TOPIC_COLOR = "#64748B"; // muted-foreground schiarito: concetto senza argomento
export const ACCENT = "#EA580C"; // --accent: nodo appena aggiunto
export const PRIMARY = "#2563EB"; // --primary: nodo selezionato
export const FOREGROUND = "#1E293B"; // --foreground: etichette
export const BACKGROUND = "#F8FAFC"; // --background: alone delle etichette
export const EDGE = "#CBD5E1"; // archi a riposo, un tono sopra --border per leggersi sul fondo
export const EDGE_FOCUS = "#1E293B"; // archi del nodo in fuoco: contrasto pieno

export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Etichette delle relazioni dal punto di vista del concetto aperto.
export const RELATION_LABELS: Record<RelationType, { out: string; in: string }> = {
  prerequisito: { out: "È prerequisito di", in: "Richiede" },
  parte_di: { out: "È parte di", in: "Comprende" },
  generalizza: { out: "Generalizza", in: "È un caso di" },
  usa: { out: "Usa", in: "È usato da" },
  contrasta: { out: "Contrasta con", in: "Contrasta con" },
};

// «L08_q_learning_sarsa» diventa «L08»; altri titoli restano interi.
export function shortSource(title: string) {
  return title.match(/^(L\d+)[_\s-]/i)?.[1] ?? title;
}
