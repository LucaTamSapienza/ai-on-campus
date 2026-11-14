"use client";

// La tela a forze: nodi = concetti, colore per argomento, raggio per numero di relazioni.
// Da caricare con next/dynamic senza SSR (usa window e canvas).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// @ts-expect-error: d3-force-3d (motore di react-force-graph) non ha tipi.
import { forceX, forceY } from "d3-force-3d";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { Graph, RelationType } from "@/lib/api";
import { ACCENT, BACKGROUND, EDGE, EDGE_FOCUS, FOREGROUND, PRIMARY, withAlpha } from "@/lib/graph-style";

type GNode = NodeObject & { id: string; name: string; topicId: string | null; degree: number; bornAt: number };
type GLink = LinkObject<GNode> & { id: string; type: RelationType };

const GROW_MS = 300;
const NEW_MS = 5000;
const LABEL_ZOOM = 1.8;

export type GraphCanvasProps = {
  graph: Graph;
  colorOf: (topicId: string | null) => string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  activeTopics: Set<string>;
  // Cambia nonce per portare la tela su un concetto (ricerca, relazioni nel dettaglio).
  centerOn: { id: string; nonce: number } | null;
  // Parte bassa della tela coperta da un foglio (0,5 su telefono con il dettaglio aperto):
  // il concetto si centra nella parte che resta visibile.
  coveredBottom?: number;
};

const radius = (n: { degree: number }) => 4 + Math.sqrt(n.degree) * 2.6;
const endId = (end: GLink["source"]) => (typeof end === "object" ? (end as GNode).id : String(end));

export default function GraphCanvas({ graph, colorOf, selectedId, onSelect, activeTopics, centerOn, coveredBottom = 0 }: GraphCanvasProps) {
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const nodesById = useRef(new Map<string, GNode>());
  const loadedOnce = useRef(false);
  // Finché l'utente non sposta la tela, a ogni assestamento si inquadra tutto il grafo:
  // i concetti nuovi del Cartografo restano visibili mentre arrivano.
  const userMoved = useRef(false);
  // Il canvas non risolve var(): si legge la famiglia vera dal body.
  const fontFamily = useMemo(() => (typeof window !== "undefined" ? getComputedStyle(document.body).fontFamily : "system-ui"), []);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Dimensioni della tela = dimensioni del contenitore.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // I nodi già presenti tengono la loro posizione: i nuovi entrano accanto a un vicino, senza rifare il layout.
  const data = useMemo(() => {
    const now = performance.now();
    const prev = nodesById.current;
    const next = new Map<string, GNode>();
    for (const c of graph.concepts) {
      const old = prev.get(c.id);
      if (old) {
        Object.assign(old, { name: c.name, topicId: c.topicId, degree: c.degree });
        next.set(c.id, old);
      } else {
        next.set(c.id, { id: c.id, name: c.name, topicId: c.topicId, degree: c.degree, bornAt: loadedOnce.current ? now : -Infinity });
      }
    }
    const links: GLink[] = graph.relations
      .filter((r) => next.has(r.source) && next.has(r.target))
      .map((r) => ({ id: r.id, source: r.source, target: r.target, type: r.type }));
    for (const l of links) {
      const a = next.get(l.source as string)!;
      const b = next.get(l.target as string)!;
      for (const [fresh, anchor] of [
        [a, b],
        [b, a],
      ]) {
        if (fresh.x === undefined && anchor.x !== undefined) {
          fresh.x = anchor.x + (Math.random() - 0.5) * 30;
          fresh.y = (anchor.y ?? 0) + (Math.random() - 0.5) * 30;
        }
      }
    }
    nodesById.current = next;
    if (graph.concepts.length) loadedOnce.current = true;
    return { nodes: [...next.values()], links };
  }, [graph]);

  // Vicini di ogni nodo, per il fuoco.
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const s = endId(l.source);
      const t = endId(l.target);
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    }
    return m;
  }, [data]);

  // Le etichette sempre visibili: i nodi più connessi, quanti ne entrano nella larghezza della tela
  // (circa uno ogni 150 px: su telefono 2-3, su desktop una decina) senza superare un quarto dei nodi.
  const topIds = useMemo(() => {
    const sorted = [...data.nodes].sort((a, b) => b.degree - a.degree);
    const n = Math.min(Math.ceil(sorted.length / 4), Math.max(2, Math.floor(size.width / 150)));
    return new Set(sorted.slice(0, n).map((x) => x.id));
  }, [data, size.width]);

  // Tutto ciò che il disegno legge sta in un ref: la tela si ridisegna a ogni frame.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const view = useRef({ focusId: null as string | null, selectedId, activeTopics, neighbors, topIds, k: 1, colorOf });
  view.current = { ...view.current, focusId: hoverId ?? selectedId, selectedId, activeTopics, neighbors, topIds, colorOf };

  const isDimmed = useCallback((id: string, topicId: string | null) => {
    const v = view.current;
    if (v.activeTopics.size && !(topicId && v.activeTopics.has(topicId))) return true;
    if (v.focusId && id !== v.focusId && !v.neighbors.get(v.focusId)?.has(id)) return true;
    return false;
  }, []);

  const drawNode = useCallback(
    (node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const v = view.current;
      const age = performance.now() - node.bornAt;
      const grow = reducedMotion ? 1 : Math.min(1, age / GROW_MS);
      const r = radius(node) * grow;
      if (r <= 0) return;
      const dim = isDimmed(node.id, node.topicId);
      const base = age < NEW_MS ? ACCENT : v.colorOf(node.topicId);
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
      ctx.fillStyle = dim ? withAlpha(base, 0.2) : base;
      ctx.fill();
      if (node.id === v.selectedId) {
        ctx.lineWidth = 2.5 / scale;
        ctx.strokeStyle = PRIMARY;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r + 3 / scale, 0, 2 * Math.PI);
        ctx.stroke();
      }
      const inFocus = v.focusId && (node.id === v.focusId || v.neighbors.get(v.focusId)?.has(node.id));
      const showLabel = !dim && (v.k >= LABEL_ZOOM || v.topIds.has(node.id) || inFocus);
      if (showLabel) {
        // 13 px a schermo (14 e più spesse per il nodo in fuoco): si leggono anche da un proiettore.
        const strong = node.id === v.focusId;
        const fontSize = (strong ? 14 : 13) / scale;
        ctx.font = `${strong ? 700 : 600} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const y = node.y! + r + 3 / scale;
        ctx.lineWidth = 4 / scale;
        ctx.strokeStyle = BACKGROUND;
        ctx.strokeText(node.name, node.x!, y);
        ctx.fillStyle = FOREGROUND;
        ctx.fillText(node.name, node.x!, y);
      }
    },
    [isDimmed, reducedMotion, fontFamily],
  );

  // Area di tocco di almeno 44 px di diametro anche per i nodi piccoli.
  const paintPointer = useCallback((node: GNode, color: string, ctx: CanvasRenderingContext2D, scale: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, Math.max(radius(node) + 2, 22 / scale), 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const linkTouchesFocus = (l: GLink) => {
    const f = view.current.focusId;
    return !!f && (endId(l.source) === f || endId(l.target) === f);
  };

  // Porta la tela su un concetto.
  useEffect(() => {
    if (!centerOn) return;
    const n = nodesById.current.get(centerOn.id);
    if (n?.x !== undefined) {
      userMoved.current = true;
      const k = Math.max(view.current.k, 2.2);
      fgRef.current?.centerAt(n.x, (n.y ?? 0) + (size.height * coveredBottom) / 2 / k, 500);
      fgRef.current?.zoom(k, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOn]);

  // Forze un po' più larghe del predefinito, perché le etichette respirino.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-140);
    (fg.d3Force("link") as unknown as { distance?: (d: number) => void })?.distance?.(46);
    // Una spinta leggera verso il centro: i concetti ancora senza relazioni non scappano dall'inquadratura.
    fg.d3Force("x", forceX(0).strength(0.06));
    fg.d3Force("y", forceY(0).strength(0.06));
  }, [size.width > 0]);

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none"
      onPointerDown={() => (userMoved.current = true)}
      onWheel={() => (userMoved.current = true)}
    >
      {size.width > 0 && (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor={BACKGROUND}
          nodeRelSize={1}
          nodeVal={(n) => radius(n) ** 2}
          nodeLabel={() => ""}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={paintPointer}
          linkColor={(l) => (linkTouchesFocus(l) ? EDGE_FOCUS : view.current.focusId ? withAlpha(EDGE, 0.35) : EDGE)}
          linkWidth={(l) => (linkTouchesFocus(l) ? 2 : 1)}
          linkLineDash={(l) => (l.type === "contrasta" ? [4, 3] : null)}
          linkDirectionalArrowLength={(l) => (l.type === "prerequisito" ? 5 : 0)}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(l) => (linkTouchesFocus(l) ? EDGE_FOCUS : EDGE)}
          autoPauseRedraw={false}
          warmupTicks={reducedMotion ? 200 : 0}
          cooldownTicks={reducedMotion ? 0 : 120}
          onZoom={(t) => (view.current.k = t.k)}
          onEngineStop={() => {
            if (!userMoved.current && data.nodes.length) fgRef.current?.zoomToFit(reducedMotion ? 0 : 400, 48);
          }}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={(n) => onSelect(n.id)}
          onBackgroundClick={() => onSelect(null)}
          enableNodeDrag
        />
      )}
    </div>
  );
}
