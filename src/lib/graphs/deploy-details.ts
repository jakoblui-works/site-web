/** What the x-ray says about each part of the deploy graph. */

import type { NodeDetails, NodeLink } from "@/lib/infra-graph";

const org: NodeLink = {
  label: "GitHub",
  url: "https://github.com/jakoblui-works",
};

export const deployDetails: Record<string, NodeDetails> = {
  me: {
    summary:
      "Me, at my laptop. I push code and run Terraform; everything after a push is automated.",
    stack: ["git", "Terraform CLI"],
    decisions: ["A push to main is a deploy: there's no separate release step."],
    links: [org],
  },
  repos: {
    summary:
      "One repo per deployable: api, cv-service, cv-web, site-web and storybook-host. All public; only infra is private.",
    stack: ["GitHub"],
    decisions: [
      "Public on purpose: no secrets in code or images; they live in an Ansible vault in the private infra repo.",
    ],
    links: [org],
  },
  actions: {
    summary:
      "CI on every pull request. On a push to main it runs the same checks, builds the images and asks infra to deploy.",
    stack: ["GitHub Actions", "uv · ruff · pytest", "pnpm · ESLint · Vitest", "Playwright"],
    decisions: [
      "The deploy workflow calls the CI workflow first, so nothing ships that wouldn't pass a pull request.",
      "cv-web regenerates its API client from the production spec, and CI fails if it drifts.",
    ],
    links: [],
  },
  ghcr: {
    summary: "GitHub's container registry: each image is tagged with its commit sha and latest.",
    stack: ["GHCR", "Docker"],
    decisions: ["The images are public, so nothing secret is baked into them."],
    links: [],
  },
  infra: {
    summary:
      "The private infra repo's deploy workflow: it runs an Ansible playbook against the droplet over SSH.",
    stack: ["GitHub Actions", "Ansible", "Ansible Vault", "Docker Compose"],
    decisions: [
      "Any app repo triggers it with a repository_dispatch, so changes to infra go live with the next deploy.",
      "Environment before code: compose file and .env first, then pull, migrate, and start.",
      "Each deploy ends by pruning dangling images; GHCR keeps the old versions for rollback.",
    ],
    links: [],
  },
  terraform: {
    summary:
      "Provisions the cloud resources: the droplet, a reserved IP, the DNS records, the disk alert and the uptime checks.",
    stack: ["Terraform", "DigitalOcean provider", "Grafana provider"],
    decisions: [
      "Infrastructure as code: Terraform creates the machine and its DNS; Ansible configures and deploys onto it.",
      "Run from my laptop: changes to the infrastructure are rare and deliberate.",
    ],
    links: [],
  },
  digitalocean: {
    summary:
      "The cloud provider: one droplet in Frankfurt, a reserved IP, DNS for jakoblui.com, and an alert when the disk fills up.",
    stack: ["DigitalOcean", "Droplet", "Reserved IP", "DNS", "Monitoring"],
    decisions: [
      "One small droplet runs everything; the reserved IP keeps DNS pointing at it if it's ever replaced.",
    ],
    links: [],
  },
  droplet: {
    summary:
      "An Ubuntu server running everything in one Docker Compose project: the runtime view shows what's inside.",
    stack: ["Ubuntu 24.04", "Docker Compose", "ufw", "unattended-upgrades", "do-agent"],
    decisions: [
      "Set up by an Ansible playbook: a deploy user, SSH keys only, and a firewall open to SSH, HTTP and HTTPS.",
      "Migrations run as one-off containers before the services start.",
      "Security updates install themselves; if one needs a reboot, it happens at 04:00 UTC.",
      "Container logs are capped at 3 × 10 MB per service.",
    ],
    links: [],
  },
  grafana: {
    summary: "Grafana Cloud's synthetic monitoring: the uptime checks and their alert rule.",
    stack: ["Grafana Cloud", "Synthetic Monitoring"],
    decisions: [
      "Checks as code: the URLs, probes and alert rule live in Terraform, not in a dashboard.",
    ],
    links: [],
  },
};
