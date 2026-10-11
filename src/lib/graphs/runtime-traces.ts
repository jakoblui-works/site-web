/** The runtime graph's traces, grouped by what they do. */

import type { TraceGroup } from "@/lib/infra-graph";

export const runtimeTraceGroups: TraceGroup[] = [
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
