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

/** Where everything sits in one arrangement. Positions are node centres, in viewBox units. */
export type GraphLayout = {
  width: number;
  height: number;
  node: { width: number; height: number };
  casing: Rect;
  positions: Record<string, Point>;
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

/** Wide screens: requests flow left to right, data stores along the bottom. */
export const landscapeLayout: GraphLayout = {
  width: 1160,
  height: 720,
  node: { width: 170, height: 60 },
  casing: { x: 200, y: 40, width: 900, height: 560 },
  positions: {
    browser: { x: 100, y: 330 },
    dns: { x: 100, y: 130 },
    traefik: { x: 340, y: 330 },
    "site-web": { x: 580, y: 120 },
    "cv-web": { x: 780, y: 120 },
    storybook: { x: 980, y: 120 },
    api: { x: 580, y: 330 },
    redis: { x: 780, y: 330 },
    "cv-worker": { x: 980, y: 330 },
    postgres: { x: 680, y: 520 },
    garage: { x: 880, y: 520 },
    sentry: { x: 580, y: 665 },
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
};
