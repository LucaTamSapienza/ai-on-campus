// Colori e testi del grafo, dai token di docs/design-system.md. Il canvas non legge le classi
// Tailwind, quindi i valori stanno qui e non nelle pagine.
import type { RelationType } from "@/lib/api";

export const TOPIC_COUNT = 12;

// Classi dei pallini degli argomenti (token --color-topic-N di globals.css), scritte per esteso
// perché Tailwind le trovi.
const TOPIC_DOTS = [
  "bg-topic-1", "bg-topic-2", "bg-topic-3", "bg-topic-4", "bg-topic-5", "bg-topic-6",
  "bg-topic-7", "bg-topic-8", "bg-topic-9", "bg-topic-10", "bg-topic-11", "bg-topic-12",
];
export const topicDotClass = (slot: number | null) => (slot === null ? "bg-topic-none" : TOPIC_DOTS[slot % TOPIC_COUNT]);

// Colori del grafo letti dai token di globals.css: il canvas non legge le classi Tailwind.
export type GraphTheme = {
  topics: string[];
  noTopic: string;
  newNode: string;
  selected: string;
  edge: string;
  edgeFocus: string;
  label: string;
  halo: string;
};

export function readGraphTheme(): GraphTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    topics: Array.from({ length: TOPIC_COUNT }, (_, i) => v(`--topic-${i + 1}`)),
    noTopic: v("--graph-no-topic"),
    newNode: v("--graph-node-new"),
    selected: v("--graph-node-selected"),
    edge: v("--graph-edge"),
    edgeFocus: v("--graph-edge-focus"),
    label: v("--graph-label"),
    halo: v("--graph-halo"),
  };
}

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
