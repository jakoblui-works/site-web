/** The deploy graph's traces, grouped by what they do. */

import type { TraceGroup } from "@/lib/infra-graph";

export const deployTraceGroups: TraceGroup[] = [
  {
    id: "push",
    title: "Push",
    path: "Me → app repos → CI",
    edges: ["me->repos", "repos->actions"],
    labels: {
      "me->repos": ["git push", "a push to main is a deploy"],
      "repos->actions": ["runs CI", "lint, tests, build"],
    },
  },
  {
    id: "images",
    title: "Images",
    path: "CI → GHCR → droplet",
    edges: ["actions->ghcr", "ghcr->droplet"],
    labels: {
      "actions->ghcr": ["pushes images", "tagged with the commit sha"],
      "ghcr->droplet": ["docker pull", "public images, no secrets"],
    },
  },
  {
    id: "rollout",
    title: "Rollout",
    path: "CI → infra → droplet",
    edges: ["actions->infra", "infra->droplet"],
    labels: {
      "actions->infra": ["dispatch", "every repo deploys the same way"],
      "infra->droplet": ["Ansible over SSH", "environment first, then code"],
    },
  },
  {
    id: "provisioning",
    title: "Provisioning",
    path: "Me → Terraform → DigitalOcean → droplet",
    edges: ["me->terraform", "terraform->digitalocean", "digitalocean->droplet"],
    labels: {
      "me->terraform": ["terraform apply", "by hand, rarely"],
      "terraform->digitalocean": ["DigitalOcean API", "droplet, IP, DNS records"],
      "digitalocean->droplet": ["provisions", "Ubuntu 24.04 in fra1"],
    },
  },
];
