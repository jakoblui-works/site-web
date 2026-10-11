/** The traces, grouped by what they do: what the x-ray shows when a trace is clicked. */

import {
  edgeId,
  edgeRoute,
  edges,
  type GraphLayout,
  type Rect,
} from "./infra-graph";

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

export const traceGroups: TraceGroup[] = [
  {
    id: "request-path",
    title: "Request path",
    path: "You → DNS, Traefik",
    edges: ["browser->dns", "browser->traefik"],
    labels: {
      "browser->dns": ["DNS → the droplet", "records are Terraform code"],
      "browser->traefik": ["HTTPS to Traefik", "the only thing open to the internet"],
    },
  },
  {
    id: "routing",
    title: "Routing",
    path: "Traefik → site-web, cv-web, Storybook, api",
    edges: ["traefik->site-web", "traefik->cv-web", "traefik->storybook", "traefik->api"],
    labels: {
      "traefik->site-web": ["jakoblui.com", "static files, nginx"],
      "traefik->cv-web": ["cv.jakoblui.com", "a frontend per project"],
      "traefik->storybook": ["Storybook subdomain", "both frontends' stories"],
      "traefik->api": ["/api routes", "rate-limited here, at the edge"],
    },
  },
  {
    id: "job-queue",
    title: "Job queue",
    path: "api → Redis → cv-worker",
    edges: ["api->redis", "redis->cv-worker"],
    labels: {
      "api->redis": ["cv.generate.v1 jobs", "identical requests share one task"],
      "redis->cv-worker": ["typeset with LaTeX", "hands back the PDF's key"],
    },
  },
  {
    id: "storage",
    title: "Storage",
    path: "api, cv-worker → Postgres, Garage",
    edges: ["api->postgres", "api->garage", "cv-worker->postgres", "cv-worker->garage"],
    labels: {
      "api->postgres": ["published options", "read with plain SQL"],
      "api->garage": ["PDFs by digest"],
      "cv-worker->postgres": ["owns the CV schema", "and its migrations"],
      "cv-worker->garage": ["each PDF once", "keyed by a hash of its LaTeX"],
    },
  },
  {
    id: "errors",
    title: "Error reporting",
    path: "api → Sentry",
    edges: ["api->sentry"],
    labels: {
      "api->sentry": ["unhandled errors", "the worker doesn't report yet"],
    },
  },
];

/**
 * How labels are set (px): a fixed size, wide screens and narrow (where only the first line shows),
 * this far from their trace. The font is mono, so a line is `charWidth` em per character.
 */
/** On narrow screens, how many screen widths a framed group may span (it's cropped at the sides). */
export const NARROW_CROP = 1.4;

export const LABEL_STYLE = {
  offset: 10,
  fontSize: { wide: 13, narrow: 11 },
  lineHeight: 1.375,
  charWidth: 0.6,
};

export const traceGroupOf = (id: string) =>
  traceGroups.find((group) => group.edges.includes(id));

/** The area a group covers in a layout (viewBox units): its traces and the parts they connect. */
export const traceArea = (layout: GraphLayout, group: TraceGroup): Rect => {
  const groupEdges = edges.filter((edge) => group.edges.includes(edgeId(edge)));
  const { width, height } = layout.node;
  const points = groupEdges.flatMap((edge) => [
    ...edgeRoute(layout, edge),
    ...[edge.from, edge.to].flatMap((id) => {
      const { x, y } = layout.positions[id];
      return [
        { x: x - width / 2, y: y - height / 2 },
        { x: x + width / 2, y: y + height / 2 },
      ];
    }),
  ]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};
