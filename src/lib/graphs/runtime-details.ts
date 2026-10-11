/** What the x-ray says about each part of the runtime graph. */

import type { NodeDetails, NodeLink } from "@/lib/infra-graph";

const repo = (name: string): NodeLink => ({
  label: "Repo",
  url: `https://github.com/jakoblui-works/${name}`,
});
const storybook: NodeLink = {
  label: "Storybook",
  url: "https://storybook.jakoblui.com",
};

export const runtimeDetails: Record<string, NodeDetails> = {
  browser: {
    summary:
      "Your browser. Every request starts here: DNS resolves the domain to the droplet, then HTTPS goes to Traefik.",
    stack: [],
    decisions: ["You're looking at site-web right now, through its own x-ray."],
    links: [],
  },
  dns: {
    summary: "DNS for jakoblui.com and its subdomains, at DigitalOcean.",
    stack: ["DigitalOcean DNS", "Terraform"],
    decisions: [
      "Infrastructure as code: Terraform provisions the droplet and the DNS records; Ansible configures and deploys.",
    ],
    links: [],
  },
  traefik: {
    summary:
      "The only thing listening on the internet: it terminates TLS and routes each subdomain and path to a container.",
    stack: ["Traefik v3.7", "Docker labels"],
    decisions: [
      "Rate limiting at the edge, not in the app: Traefik sees the real client IPs.",
      "A general limit on the api, and a stricter per-minute limit on generating CVs.",
    ],
    links: [],
  },
  "site-web": {
    summary: "This page: a static React app, served by nginx.",
    stack: ["React 19", "Vite", "TanStack Router", "Tailwind 4", "shadcn on Base UI", "Storybook"],
    decisions: [
      "The x-ray: the page itself turns see-through over an interior fixed behind it.",
      "Projects are separate frontends on their own subdomains, on purpose: the architecture is part of what this shows.",
    ],
    links: [repo("site-web"), { label: "Live", url: "https://jakoblui.com" }, storybook],
  },
  "cv-web": {
    summary: "A CV generator: pick a role, concepts and skills, get a tailored PDF.",
    stack: ["React 19", "Vite", "TanStack Router + Query", "Orval + zod", "Tailwind 4"],
    decisions: [
      "The URL is the source of truth: generation runs as a query keyed on the selection, so a link always matches its PDF.",
      "The API client is generated from the OpenAPI spec, and CI fails if it drifts.",
    ],
    links: [repo("cv-web"), { label: "Live", url: "https://cv.jakoblui.com" }, storybook],
  },
  storybook: {
    summary: "One Storybook that composes the component libraries of site-web and cv-web.",
    stack: ["Storybook 10", "nginx"],
    decisions: [
      "Each frontend builds its own Storybook image on deploy; storybook-host composes them.",
    ],
    links: [repo("storybook-host"), storybook],
  },
  api: {
    summary:
      "A thin gateway: it validates requests, reads published options, and hands work to services over Redis Streams.",
    stack: ["Python 3.13", "FastAPI", "Pydantic", "SQLAlchemy async", "asyncpg"],
    decisions: [
      "Domain logic lives in services behind a queue; contracts are versioned (cv.generate.v1), never edited in place.",
      "Identical CV requests share one task: the request is canonicalised and hashed, with an in-flight key in Redis for 120 s.",
    ],
    links: [repo("api"), { label: "API docs", url: "https://cv.jakoblui.com/api/docs" }],
  },
  redis: {
    summary: "The message broker between the api and the workers, plus short-lived state.",
    stack: ["Redis 8.10", "Streams", "Taskiq"],
    decisions: [
      "Redis 8.10 for atomic claim and compare-and-delete on the in-flight keys (SET NX GET, DELEX IFEQ).",
    ],
    links: [],
  },
  "cv-worker": {
    summary: "Renders CVs: picks the content, typesets it with LaTeX, and caches the PDF.",
    stack: ["Python 3.13", "Taskiq", "LaTeX", "SQLAlchemy async"],
    decisions: [
      "Owns the whole CV domain, including its database schema and migrations.",
      "PDFs are cached by a hash of their LaTeX source, so the same CV is only typeset once.",
    ],
    links: [repo("cv-service")],
  },
  postgres: {
    summary: "Relational data, with one schema per service.",
    stack: ["PostgreSQL 18", "Alembic"],
    decisions: [
      "Each service owns its schema; the api only reads published options, with plain SQL.",
      "A new shape means a new version row, never a changed one.",
    ],
    links: [],
  },
  garage: {
    summary: "Self-hosted, S3-compatible object storage for the generated PDFs.",
    stack: ["Garage", "S3 API"],
    decisions: ["The S3 API without a cloud bucket: the same code locally and on the droplet."],
    links: [],
  },
  sentry: {
    summary: "Error reporting for the api.",
    stack: ["Sentry"],
    decisions: ["Only the api reports to it so far; the worker needs network egress first."],
    links: [],
  },
};
