/** The graphs shown in the x-ray: their shape, and how their traces are routed and labelled. */

export type NodeKind =
  | "client"
  | "external"
  | "edge"
  | "frontend"
  | "service"
  | "store";

/** Logos available to nodes (rendered by `infra-logos.tsx`). */
export type LogoId =
  | "browser"
  | "digitalocean"
  | "traefik"
  | "react"
  | "vite"
  | "storybook"
  | "fastapi"
  | "openapi"
  | "redis"
  | "python"
  | "latex"
  | "postgres"
  | "storage"
  | "sentry"
  | "laptop"
  | "github"
  | "githubactions"
  | "docker"
  | "ansible"
  | "terraform"
  | "server"
  | "grafana"
  | "metrics";

export type GraphNode = {
  id: string;
  label: string;
  /** The technology, shown in mono under the label. */
  detail: string;
  /** One or two logos, shown on the left of the node. */
  logos: LogoId[];
  kind: NodeKind;
  /** Drawn within the casing (e.g. runs inside the droplet). */
  inCasing: boolean;
};

export type GraphEdge = {
  from: string;
  to: string;
  /** Not a request path (e.g. DNS resolution, error reporting). */
  dashed?: boolean;
};

export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };

export type Axis = "x" | "y";

/**
 * How one edge is routed in a layout. By default a trace leaves and enters along the axis it mostly
 * travels on, with its diagonal in the middle.
 */
export type RouteOptions = {
  /** Leave the source through its sides (`x`) or its top/bottom (`y`). */
  exit?: Axis;
  /** Enter the target through its sides (`x`) or its top/bottom (`y`). */
  enter?: Axis;
  /** Where the bend sits along the route, 0..1 (default 0.5), so parallel traces can run apart. */
  bend?: number;
};

/**
 * Where a trace's label sits in one arrangement (hand-placed, like the routes): a point along the
 * trace, and which side of it the label goes. It follows the trace if the nodes move.
 */
export type LabelSpot = {
  /** How far along the trace, 0 (its start) to 1 (its end), by length. */
  at: number;
  side: "above" | "below" | "left" | "right";
  /** Past the nodes the trace runs between (half a node further out), not just off the line. */
  clear?: boolean;
  /** A nudge, in units, for a spot that needs it. */
  dx?: number;
  dy?: number;
};

/** The board's dot grid, in viewBox units: node centres and the casing's edges sit on it. */
export const GRID = 20;

/** Where everything sits in one arrangement. Positions are node centres, in viewBox units. */
export type GraphLayout = {
  width: number;
  height: number;
  node: { width: number; height: number };
  casing: Rect;
  positions: Record<string, Point>;
  /** Per-edge routing, keyed by `edgeId`. */
  routes?: Record<string, RouteOptions>;
  /**
   * Traces that enter the same side of a node, keyed by that node's id, by `edgeId` in order along
   * the side (left to right, or top to bottom): they share it out evenly instead of meeting at its
   * middle.
   */
  spread?: Record<string, string[]>;
  /** Which top corner of the casing its label sits in (default: left). */
  casingLabelSide?: "left" | "right";
  /** Where each trace's label sits when its group is zoomed into, keyed by `edgeId`. */
  labels?: Record<string, LabelSpot>;
};

export type NodeLink = { label: string; url: string };

/** What the x-ray shows when a node is selected: what it is, what it's built with, and why. */
export type NodeDetails = {
  /** One or two sentences: what this part does. */
  summary: string;
  stack: string[];
  /** Why it's built this way: the relevant decisions, one short line each. */
  decisions: string[];
  links: NodeLink[];
};

/** Traces grouped by what they do: what the x-ray shows when a trace is clicked. */
export type TraceGroup = {
  id: string;
  title: string;
  /** The parts it connects, in reading order. */
  path: string;
  /** Its traces, by `edgeId`. */
  edges: string[];
  /**
   * What each trace carries, printed next to it once zoomed in: one or two short lines, the first
   * what flows (short: it's all phones have room for), the second why. Keyed by `edgeId`.
   */
  labels: Record<string, string[]>;
};

/** One view of the x-ray: its parts, how they connect, where they sit, and what they say. */
export type Graph = {
  /** What it shows, for assistive tech. */
  description: string;
  /** Printed on the casing, next to a top screw (see `casingLabelSide`). */
  casingLabel: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layouts: { landscape: GraphLayout; portrait: GraphLayout };
  details: Record<string, NodeDetails>;
  traceGroups: TraceGroup[];
};

/** Whether `id` is something in the graph to zoom into: a node, or a group of traces. */
export const isZoomTarget = (graph: Graph, id: string) =>
  id in graph.details || graph.traceGroups.some((group) => group.id === id);

export const edgeId = (edge: GraphEdge) => `${edge.from}->${edge.to}`;

/** Whether the segment a→b passes through the rectangle (Liang–Barsky clipping). */
export const segmentHitsRect = (a: Point, b: Point, r: Rect) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
};


/** The largest corner cut on an L-shaped trace. */
const CHAMFER = 36;

const dedupe = (points: Point[]) =>
  points.filter(
    (point, i, all) =>
      i === 0 || point.x !== all[i - 1].x || point.y !== all[i - 1].y,
  );

/**
 * An edge's route, like a trace on a circuit board: only straight runs and 45° diagonals.
 * - Leaving and entering on the same axis: run, diagonal, run (or, if it mostly travels across
 *   that axis, diagonal, run, diagonal), with the bend where `bend` puts it.
 * - Leaving and entering on different axes: an L with its corner cut at 45°.
 * Returns the polyline's points, from the source's border to the target's border.
 */
export const edgeRoute = (layout: GraphLayout, edge: GraphEdge): Point[] => {
  const a = layout.positions[edge.from];
  const b = layout.positions[edge.to];
  const { width, height } = layout.node;
  const options = layout.routes?.[edgeId(edge)] ?? {};
  const dominant: Axis =
    Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "x" : "y";
  const exit = options.exit ?? dominant;
  const enter = options.enter ?? exit;
  const bend = options.bend ?? 0.5;

  const sx = Math.sign(b.x - a.x) || 1;
  const sy = Math.sign(b.y - a.y) || 1;
  const start =
    exit === "x"
      ? { x: a.x + (sx * width) / 2, y: a.y }
      : { x: a.x, y: a.y + (sy * height) / 2 };
  // Where it meets the target's side: the middle, or its share of a spread side.
  const sharing = layout.spread?.[edge.to] ?? [];
  const slot = sharing.indexOf(edgeId(edge));
  const offset = (side: number) =>
    slot === -1 ? 0 : -side / 2 + (side * (slot + 1)) / (sharing.length + 1);
  const end =
    enter === "x"
      ? { x: b.x - (sx * width) / 2, y: b.y + offset(height) }
      : { x: b.x + offset(width), y: b.y - (sy * height) / 2 };

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const ux = Math.sign(dx);
  const uy = Math.sign(dy);
  const along = (axis: Axis) => (axis === "x" ? Math.abs(dx) : Math.abs(dy));
  const step = (from: Point, axis: Axis, length: number): Point =>
    axis === "x"
      ? { x: from.x + ux * length, y: from.y }
      : { x: from.x, y: from.y + uy * length };
  const diag = (from: Point, length: number): Point => ({
    x: from.x + ux * length,
    y: from.y + uy * length,
  });

  if (exit !== enter) {
    const cut = Math.min(Math.abs(dx), Math.abs(dy), CHAMFER);
    const p1 = step(start, exit, along(exit) - cut);
    const p2 = diag(p1, cut);
    return dedupe([start, p1, p2, end]);
  }

  const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
  const other: Axis = exit === "x" ? "y" : "x";
  if (along(exit) >= along(other)) {
    const p1 = step(start, exit, (along(exit) - diagonal) * bend);
    const p2 = diag(p1, diagonal);
    return dedupe([start, p1, p2, end]);
  }
  const p1 = diag(start, diagonal * bend);
  const p2 = step(p1, other, along(other) - diagonal);
  return dedupe([start, p1, p2, end]);
};

/** The point a fraction `at` (0..1) of the way along a route, by length. */
export const pointAlong = (route: Point[], at: number): Point => {
  const runs = route.slice(1).map((point, i) => ({
    from: route[i],
    to: point,
    length: Math.hypot(point.x - route[i].x, point.y - route[i].y),
  }));
  let left = at * runs.reduce((sum, run) => sum + run.length, 0);
  for (const run of runs) {
    if (left <= run.length || run === runs[runs.length - 1]) {
      const t = run.length === 0 ? 0 : Math.min(1, left / run.length);
      return { x: run.from.x + (run.to.x - run.from.x) * t, y: run.from.y + (run.to.y - run.from.y) * t };
    }
    left -= run.length;
  }
  return route[0];
};

/** Where a trace's label is anchored in a layout (units), from its `LabelSpot`. */
export const labelAnchor = (layout: GraphLayout, edge: GraphEdge, spot: LabelSpot): Point => {
  const point = pointAlong(edgeRoute(layout, edge), spot.at);
  return { x: point.x + (spot.dx ?? 0), y: point.y + (spot.dy ?? 0) };
};
