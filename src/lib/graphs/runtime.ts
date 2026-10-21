/** The runtime infrastructure: what runs where, and what talks to what. */

import type { Graph, GraphEdge, GraphLayout, GraphNode } from "@/lib/infra-graph";

import { runtimeDetails } from "./runtime-details";
import { runtimeTraceGroups } from "./runtime-traces";

const nodes: GraphNode[] = [
  { id: "browser", label: "You", detail: "browser", logos: ["browser"], kind: "client", inCasing: false },
  { id: "dns", label: "DNS", detail: "DigitalOcean", logos: ["digitalocean"], kind: "external", inCasing: false },
  { id: "traefik", label: "Traefik", detail: "reverse proxy", logos: ["traefik"], kind: "edge", inCasing: true },
  { id: "site-web", label: "site-web", detail: "React · Vite", logos: ["react", "vite"], kind: "frontend", inCasing: true },
  { id: "cv-web", label: "cv-web", detail: "React · Vite", logos: ["react", "vite"], kind: "frontend", inCasing: true },
  { id: "storybook", label: "Storybook", detail: "composed", logos: ["storybook"], kind: "frontend", inCasing: true },
  { id: "api", label: "api", detail: "FastAPI · REST", logos: ["fastapi", "openapi"], kind: "service", inCasing: true },
  { id: "redis", label: "Redis", detail: "Streams", logos: ["redis"], kind: "store", inCasing: true },
  { id: "cv-worker", label: "cv-worker", detail: "Taskiq · LaTeX", logos: ["python", "latex"], kind: "service", inCasing: true },
  { id: "postgres", label: "Postgres", detail: "18", logos: ["postgres"], kind: "store", inCasing: true },
  { id: "garage", label: "Garage", detail: "S3", logos: ["storage"], kind: "store", inCasing: true },
  { id: "sentry", label: "Sentry", detail: "errors", logos: ["sentry"], kind: "external", inCasing: false },
];

const edges: GraphEdge[] = [
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

/**
 * Wide screens: Traefik feeds the frontend row from below along a shared bus, the api row sits
 * below that, and the data stores at the bottom.
 */
const landscapeLayout: GraphLayout = {
  width: 1160,
  height: 760,
  node: { width: 170, height: 60 },
  casing: { x: 200, y: 40, width: 900, height: 620 },
  positions: {
    browser: { x: 100, y: 340 },
    dns: { x: 100, y: 140 },
    traefik: { x: 360, y: 340 },
    "site-web": { x: 580, y: 140 },
    "cv-web": { x: 780, y: 140 },
    storybook: { x: 980, y: 140 },
    api: { x: 580, y: 460 },
    redis: { x: 780, y: 460 },
    "cv-worker": { x: 980, y: 460 },
    postgres: { x: 680, y: 600 },
    garage: { x: 880, y: 600 },
    sentry: { x: 420, y: 720 },
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
const portraitLayout: GraphLayout = {
  width: 480,
  height: 1000,
  node: { width: 170, height: 58 },
  casing: { x: 20, y: 140, width: 440, height: 740 },
  positions: {
    browser: { x: 300, y: 60 },
    dns: { x: 100, y: 60 },
    traefik: { x: 120, y: 200 },
    "site-web": { x: 360, y: 200 },
    "cv-web": { x: 360, y: 300 },
    storybook: { x: 360, y: 400 },
    api: { x: 120, y: 400 },
    redis: { x: 360, y: 540 },
    "cv-worker": { x: 360, y: 640 },
    postgres: { x: 120, y: 800 },
    garage: { x: 340, y: 800 },
    sentry: { x: 240, y: 940 },
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
    "api->postgres": { at: 0.8, side: "right" },
    "api->garage": { at: 0.2, side: "right" },
    "cv-worker->postgres": { at: 0.5, side: "left" },
    "cv-worker->garage": { at: 1, side: "below", dy: 60 },
    "api->sentry": { at: 0.5, side: "left" },
  },
};

export const runtimeGraph: Graph = {
  description:
    "Infrastructure: a browser reaches Traefik on a DigitalOcean droplet, which routes to the frontends and the api; the api queues CV jobs on Redis for the cv-worker, and both use Postgres and Garage.",
  casingLabel: "DigitalOcean droplet · fra1",
  nodes,
  edges,
  layouts: { landscape: landscapeLayout, portrait: portraitLayout },
  details: runtimeDetails,
  traceGroups: runtimeTraceGroups,
};
