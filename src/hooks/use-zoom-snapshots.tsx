import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { InfraGraph } from "@/components/infra-graph";
import type { GraphId } from "@/lib/graphs";
import type { Graph, GraphLayout, Rect } from "@/lib/infra-graph";
import { averageBackground, rasterize } from "@/lib/svg-image";
import { fitScale, type Camera } from "@/lib/zoom";

/**
 * Firefox draws SVG on the CPU and redraws all of it at every new scale, so a zoom stalls; it scales
 * bitmaps smoothly. There, the camera carries snapshots of the graph while it moves (see `Xray`).
 */
export const SNAPSHOTS = typeof CSS !== "undefined" && CSS.supports("-moz-appearance", "none");

/** The longest side of a whole-screen snapshot (device px): sharper costs too much memory. */
const MAX_SIDE = 3200;
/** How many snapshots of each kind are kept. */
const KEEP = { start: 4, target: 4, final: 2 };

/**
 * What a snapshot shows, for zooming into a node or group of traces: how the zoom starts (it's
 * selected, nothing dimmed yet); how it continues (the rest dimmed, a node's header gone); and the
 * view the camera ends on (`camera`), drawn at screen resolution.
 */
export type Shot =
  | { kind: "start" | "target"; id: string }
  | { kind: "final"; id: string; camera: Camera };

/** A bitmap of part of the scene, and where it goes: stage px, before the camera. */
export type Snapshot = { canvas: HTMLCanvasElement; rect: Rect };

/**
 * Snapshots of the x-ray's graph, made from a hidden copy of it in the state each one shows, and
 * kept for as long as the graph, its layout and the screen stay the same. `hidden` is that copy:
 * render it inside the stage, so it's laid out like the graph.
 */
export const useZoomSnapshots = (
  graphId: GraphId,
  graph: Graph,
  layout: GraphLayout,
  stageRef: RefObject<HTMLElement | null>,
) => {
  const cache = useRef(new Map<string, Snapshot>());
  const [queue, setQueue] = useState<{ key: string; shot: Shot }[]>([]);
  // Re-renders when a snapshot is ready.
  const [, setReady] = useState(0);
  const hiddenRef = useRef<HTMLDivElement>(null);
  // What snapshots are filled with: the interior's background, as bright as with its grain.
  const background = useRef<Promise<string | undefined>>(null);

  /** Everything a snapshot depends on besides what it shows. */
  const base = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    return `${graphId}|${layout.width}x${layout.height}|${stage.offsetLeft},${stage.offsetTop},${stage.offsetWidth}x${stage.offsetHeight}|${innerWidth}x${innerHeight}@${devicePixelRatio}`;
  };
  const keyOf = (shot: Shot) => {
    const prefix = base();
    if (!prefix) return null;
    if (shot.kind !== "final") return `${prefix}|${shot.kind}|${shot.id}`;
    // Close enough that the snapshot lines up with the live graph to well under a pixel.
    const { x, y, scale } = shot.camera;
    return `${prefix}|final|${shot.id}|${x.toFixed(1)},${y.toFixed(1)},${scale.toFixed(4)}`;
  };

  /** The snapshot of `shot`, if it's ready. */
  const get = (shot: Shot) => {
    const key = keyOf(shot);
    return key ? cache.current.get(key) : undefined;
  };

  /**
   * Makes a snapshot of `shot`, unless it's ready or on its way. A newer start or target replaces one
   * of its kind still waiting (the pointer has moved on).
   */
  const prepare = (shot: Shot) => {
    const key = keyOf(shot);
    if (!SNAPSHOTS || !key || cache.current.has(key)) return;
    setQueue((waiting) => {
      if (waiting.some((request) => request.key === key)) return waiting;
      const kept = waiting.filter(
        (request, i) => i === 0 || request.shot.kind !== shot.kind || shot.kind === "final",
      );
      return [...kept, { key, shot }];
    });
  };

  // One at a time: the hidden copy renders in the first request's state, then it's drawn.
  const active = queue[0];
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const done = () => {
      if (!cancelled) setQueue((waiting) => waiting.slice(1));
    };
    const svg = hiddenRef.current?.querySelector("svg");
    const stage = stageRef.current;
    const section = stage?.closest("section");
    if (!svg || !stage || !section || keyOf(active.shot) !== active.key) {
      done();
      return;
    }
    // What it covers, in stage px: the whole screen before zooming, or once zoomed in.
    const camera = active.shot.kind === "final" ? active.shot.camera : null;
    const scale = camera?.scale ?? 1;
    const rect = {
      x: (-stage.offsetLeft - (camera?.x ?? 0)) / scale,
      y: (-stage.offsetTop - (camera?.y ?? 0)) / scale,
      width: innerWidth / scale,
      height: innerHeight / scale,
    };
    // As sharp as the screen once zoomed in; the whole screen up to twice that, within `MAX_SIDE`.
    const density = camera
      ? devicePixelRatio
      : Math.min(2 * devicePixelRatio, MAX_SIDE / Math.max(innerWidth, innerHeight));
    const size = {
      width: Math.ceil(innerWidth * density),
      height: Math.ceil(innerHeight * density),
    };
    // The same region in the graph's viewBox units (fitted `xMidYMid meet` in the stage).
    const fit = fitScale(layout, { width: stage.offsetWidth, height: stage.offsetHeight });
    const offset = {
      x: (stage.offsetWidth - layout.width * fit) / 2,
      y: (stage.offsetHeight - layout.height * fit) / 2,
    };
    const viewBox = {
      x: (rect.x - offset.x) / fit,
      y: (rect.y - offset.y) / fit,
      width: rect.width / fit,
      height: rect.height / fit,
    };
    background.current ??= averageBackground(section).catch(() => undefined);
    background.current
      .then((fill) => rasterize(svg, size, { viewBox, background: fill }))
      .then((canvas) => {
        if (cancelled) return;
        const snapshots = cache.current;
        snapshots.set(active.key, { canvas, rect });
        // Only the newest few of each kind are kept.
        for (const kind of ["start", "target", "final"] as const) {
          const keys = [...snapshots.keys()].filter((key) => key.includes(`|${kind}|`));
          keys.slice(0, -KEEP[kind]).forEach((key) => snapshots.delete(key));
        }
        setReady((count) => count + 1);
      })
      .catch(() => {})
      .finally(done);
    return () => {
      cancelled = true;
    };
  }, [active]);

  const isGroup = (id: string) => graph.traceGroups.some((group) => group.id === id);
  const shot = active?.shot;
  // A fresh copy for each snapshot, without transitions: it's drawn in the state it shows, not on its
  // way there from the last one's.
  const hidden = shot ? (
    <div
      key={active.key}
      ref={hiddenRef}
      aria-hidden
      className="pointer-events-none invisible absolute inset-0 [&_*]:transition-none"
    >
      <InfraGraph
        graph={graph}
        layout={layout}
        decorative
        grid
        {...(isGroup(shot.id) ? { selectedGroup: shot.id } : { selected: shot.id })}
        dim={shot.kind !== "start"}
        zoomedInto={
          shot.kind !== "start" && !isGroup(shot.id) ? { id: shot.id, headerOpacity: 0 } : null
        }
        className="size-full"
      />
    </div>
  ) : null;

  return { get, prepare, hidden };
};

/**
 * A snapshot in the scene, where it covers (inside the camera, so it moves and scales with it).
 * Opaque, so one fading in over another cross-fades cleanly.
 */
export const SnapshotLayer = ({ snapshot, opacity }: { snapshot: Snapshot; opacity: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const { canvas } = snapshot;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ref.current?.replaceChildren(canvas);
  }, [snapshot]);
  const { x, y, width, height } = snapshot.rect;
  return (
    <div
      ref={ref}
      aria-hidden
      style={{ left: x, top: y, width, height, opacity }}
      className="pointer-events-none absolute"
    />
  );
};
