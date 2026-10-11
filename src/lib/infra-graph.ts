/** The runtime infrastructure shown in the x-ray: what runs where, and what talks to what. */

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
  | "sentry";

export type GraphNode = {
  id: string;
  label: string;
  /** The technology, shown in mono under the label. */
  detail: string;
  /** One or two logos, shown on the left of the node. */
  logos: LogoId[];
  kind: NodeKind;
  /** Runs inside the droplet (drawn within the casing). */
  inDroplet: boolean;
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

/** Where everything sits in one arrangement. Positions are node centres, in viewBox units. */
export type GraphLayout = {
  width: number;
  height: number;
  node: { width: number; height: number };
  casing: Rect;
  positions: Record<string, Point>;
  /** Per-edge routing, keyed by `edgeId`. */
  routes?: Record<string, RouteOptions>;
  /** Where each trace's label sits when its group is zoomed into, keyed by `edgeId`. */
  labels?: Record<string, LabelSpot>;
};

export const nodes: GraphNode[] = [
  { id: "browser", label: "You", detail: "browser", logos: ["browser"], kind: "client", inDroplet: false },
  { id: "dns", label: "DNS", detail: "DigitalOcean", logos: ["digitalocean"], kind: "external", inDroplet: false },
  { id: "traefik", label: "Traefik", detail: "reverse proxy", logos: ["traefik"], kind: "edge", inDroplet: true },
  { id: "site-web", label: "site-web", detail: "React · Vite", logos: ["react", "vite"], kind: "frontend", inDroplet: true },
  { id: "cv-web", label: "cv-web", detail: "React · Vite", logos: ["react", "vite"], kind: "frontend", inDroplet: true },
  { id: "storybook", label: "Storybook", detail: "composed", logos: ["storybook"], kind: "frontend", inDroplet: true },
  { id: "api", label: "api", detail: "FastAPI · REST", logos: ["fastapi", "openapi"], kind: "service", inDroplet: true },
  { id: "redis", label: "Redis", detail: "Streams", logos: ["redis"], kind: "store", inDroplet: true },
  { id: "cv-worker", label: "cv-worker", detail: "Taskiq · LaTeX", logos: ["python", "latex"], kind: "service", inDroplet: true },
  { id: "postgres", label: "Postgres", detail: "18", logos: ["postgres"], kind: "store", inDroplet: true },
  { id: "garage", label: "Garage", detail: "S3", logos: ["storage"], kind: "store", inDroplet: true },
  { id: "sentry", label: "Sentry", detail: "errors", logos: ["sentry"], kind: "external", inDroplet: false },
];

export const edges: GraphEdge[] = [
  { from: "browser", to: "dns", dashed: true },
  { from: "browser", to: "traefik" },
  { from: "traefik", to: "site-web" },
  { from: "traefik", to: "cv-web" },
  { from: "traefik", to: "storybook" },
  { from: "traefik", to: "api" },
  { from: "api", to: "redis" },
  { from: "redis", to: "cv-worker" },
  { from: "api", to: "postgres" },
  { from: "api", to: "garage" },
  { from: "cv-worker", to: "postgres" },
  { from: "cv-worker", to: "garage" },
  { from: "api", to: "sentry", dashed: true },
];

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
  const end =
    enter === "x"
      ? { x: b.x - (sx * width) / 2, y: b.y }
      : { x: b.x, y: b.y - (sy * height) / 2 };

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

/**
 * Wide screens: Traefik feeds the frontend row from below along a shared bus, the api row sits
 * below that, and the data stores at the bottom.
 */
export const landscapeLayout: GraphLayout = {
  width: 1160,
  height: 760,
  node: { width: 170, height: 60 },
  casing: { x: 200, y: 40, width: 900, height: 630 },
  positions: {
    browser: { x: 100, y: 330 },
    dns: { x: 100, y: 130 },
    traefik: { x: 360, y: 330 },
    "site-web": { x: 600, y: 140 },
    "cv-web": { x: 790, y: 140 },
    storybook: { x: 980, y: 140 },
    api: { x: 600, y: 460 },
    redis: { x: 790, y: 460 },
    "cv-worker": { x: 980, y: 460 },
    postgres: { x: 690, y: 600 },
    garage: { x: 880, y: 600 },
    sentry: { x: 420, y: 710 },
  },
  routes: {
    "traefik->site-web": { exit: "x", enter: "y" },
    "traefik->cv-web": { exit: "x", enter: "y" },
    "traefik->storybook": { exit: "x", enter: "y" },
    "traefik->api": { exit: "y", enter: "x" },
    "api->postgres": { exit: "y", enter: "y" },
    "api->garage": { exit: "y", enter: "y", bend: 0.3 },
    "cv-worker->postgres": { exit: "y", enter: "y", bend: 0.7 },
    "cv-worker->garage": { exit: "y", enter: "y" },
    "api->sentry": { exit: "y", enter: "x" },
  },
  labels: {
    "browser->dns": { at: 0.5, side: "right" },
    "browser->traefik": { at: 0.5, side: "above", clear: true },
    "traefik->site-web": { at: 0.8, side: "right" },
    "traefik->cv-web": { at: 0.87, side: "right" },
    "traefik->storybook": { at: 0.9, side: "right" },
    "traefik->api": { at: 0.75, side: "below", dx: -60 },
    "api->redis": { at: 0.5, side: "above", clear: true },
    "redis->cv-worker": { at: 0.5, side: "above", clear: true },
    "api->postgres": { at: 0.5, side: "left", clear: true },
    "api->garage": { at: 0.45, side: "above" },
    "cv-worker->postgres": { at: 0.8, side: "above" },
    "cv-worker->garage": { at: 0.6, side: "right", clear: true },
    "api->sentry": { at: 0.35, side: "left" },
  },
};

/** Phones: requests flow top to bottom. */
export const portraitLayout: GraphLayout = {
  width: 480,
  height: 1000,
  node: { width: 170, height: 58 },
  casing: { x: 12, y: 130, width: 456, height: 740 },
  positions: {
    browser: { x: 300, y: 55 },
    dns: { x: 95, y: 55 },
    traefik: { x: 120, y: 210 },
    "site-web": { x: 360, y: 200 },
    "cv-web": { x: 360, y: 290 },
    storybook: { x: 360, y: 380 },
    api: { x: 120, y: 400 },
    redis: { x: 360, y: 530 },
    "cv-worker": { x: 370, y: 640 },
    postgres: { x: 110, y: 790 },
    garage: { x: 350, y: 790 },
    sentry: { x: 240, y: 930 },
  },
  routes: {
    "browser->traefik": { exit: "y", enter: "y" },
    "api->garage": { bend: 1 },
    "api->sentry": { bend: 0 },
  },
  // Narrow: one short line per label, framed closer (cropped at the sides), where there's room.
  labels: {
    "browser->dns": { at: 0.5, side: "above", clear: true },
    "browser->traefik": { at: 0.5, side: "above" },
    "traefik->site-web": { at: 0.5, side: "above", clear: true },
    "traefik->cv-web": { at: 0.5, side: "right" },
    "traefik->storybook": { at: 0.7, side: "right" },
    "traefik->api": { at: 0.5, side: "right" },
    "api->redis": { at: 0.5, side: "right" },
    "redis->cv-worker": { at: 0.45, side: "left" },
    "api->postgres": { at: 0.7, side: "right" },
    "api->garage": { at: 0.2, side: "right" },
    "cv-worker->postgres": { at: 0.5, side: "left" },
    "cv-worker->garage": { at: 1, side: "below", dy: 60 },
    "api->sentry": { at: 0.5, side: "left" },
  },
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
