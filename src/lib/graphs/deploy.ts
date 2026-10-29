/** How code gets onto the droplet: GitHub builds and ships it, Terraform provisions what it runs on. */

import type { Graph, GraphEdge, GraphLayout, GraphNode } from "@/lib/infra-graph";

import { deployDetails } from "./deploy-details";
import { deployTraceGroups } from "./deploy-traces";

const nodes: GraphNode[] = [
  { id: "me", label: "Me", detail: "laptop", logos: ["laptop"], kind: "client", inCasing: false },
  { id: "repos", label: "App repos", detail: "6 public repos", logos: ["github"], kind: "store", inCasing: true },
  { id: "actions", label: "CI", detail: "GitHub Actions", logos: ["githubactions"], kind: "edge", inCasing: true },
  { id: "ghcr", label: "GHCR", detail: "images", logos: ["docker"], kind: "store", inCasing: true },
  { id: "infra", label: "infra", detail: "Ansible deploy", logos: ["githubactions", "ansible"], kind: "service", inCasing: true },
  { id: "terraform", label: "Terraform", detail: "provisioning", logos: ["terraform"], kind: "service", inCasing: false },
  { id: "digitalocean", label: "DigitalOcean", detail: "droplet · DNS", logos: ["digitalocean"], kind: "external", inCasing: false },
  { id: "droplet", label: "Droplet", detail: "Docker Compose", logos: ["server"], kind: "service", inCasing: false },
  { id: "grafana", label: "Grafana Cloud", detail: "uptime checks", logos: ["grafana"], kind: "external", inCasing: false },
];

const edges: GraphEdge[] = [
  { from: "me", to: "repos" },
  { from: "repos", to: "actions" },
  { from: "actions", to: "ghcr" },
  { from: "ghcr", to: "droplet" },
  { from: "actions", to: "infra" },
  { from: "infra", to: "droplet" },
  { from: "me", to: "terraform" },
  { from: "terraform", to: "digitalocean" },
  { from: "digitalocean", to: "droplet", dashed: true },
  { from: "terraform", to: "grafana" },
];

/**
 * Wide screens: the code path runs left to right through GitHub along the top; the droplet sits
 * below it, fed by images and Ansible; Terraform provisions it from the bottom row.
 */
const landscapeLayout: GraphLayout = {
  width: 1160,
  height: 760,
  node: { width: 170, height: 60 },
  casing: { x: 220, y: 40, width: 880, height: 360 },
  positions: {
    me: { x: 100, y: 160 },
    repos: { x: 340, y: 160 },
    actions: { x: 600, y: 160 },
    ghcr: { x: 960, y: 160 },
    infra: { x: 600, y: 320 },
    droplet: { x: 960, y: 560 },
    terraform: { x: 340, y: 700 },
    digitalocean: { x: 600, y: 700 },
    grafana: { x: 340, y: 560 },
  },
  routes: {
    "infra->droplet": { exit: "y", enter: "x" },
    "me->terraform": { exit: "y", enter: "x" },
    "digitalocean->droplet": { exit: "x", enter: "y" },
  },
  labels: {
    "me->repos": { at: 0.5, side: "above", clear: true },
    "repos->actions": { at: 0.5, side: "above", clear: true },
    "actions->ghcr": { at: 0.5, side: "above", clear: true },
    "ghcr->droplet": { at: 0.5, side: "right" },
    "actions->infra": { at: 0.5, side: "right" },
    "infra->droplet": { at: 0.7, side: "below" },
    "me->terraform": { at: 0.3, side: "right" },
    "terraform->digitalocean": { at: 0.5, side: "above", clear: true },
    "digitalocean->droplet": { at: 0.3, side: "below" },
    "terraform->grafana": { at: 0.5, side: "left" },
  },
};

/**
 * Phones: top to bottom, with GitHub on the left and Terraform's lane down the right, outside it,
 * so provisioning doesn't cross the code path.
 */
const portraitLayout: GraphLayout = {
  width: 480,
  height: 1030,
  node: { width: 170, height: 58 },
  casing: { x: 20, y: 380, width: 320, height: 440 },
  positions: {
    grafana: { x: 380, y: 60 },
    me: { x: 120, y: 160 },
    terraform: { x: 380, y: 160 },
    digitalocean: { x: 380, y: 320 },
    repos: { x: 120, y: 440 },
    actions: { x: 120, y: 540 },
    ghcr: { x: 240, y: 660 },
    infra: { x: 120, y: 760 },
    droplet: { x: 260, y: 960 },
  },
  routes: {
    "actions->ghcr": { exit: "x", enter: "y" },
    "infra->droplet": { exit: "y", enter: "x" },
    "digitalocean->droplet": { exit: "y", enter: "x" },
  },
  // Narrow: one short line per label.
  labels: {
    "me->repos": { at: 0.5, side: "right" },
    "repos->actions": { at: 0.5, side: "right" },
    "actions->ghcr": { at: 0.85, side: "left" },
    "ghcr->droplet": { at: 0.25, side: "right" },
    "actions->infra": { at: 0.5, side: "right" },
    "infra->droplet": { at: 0.4, side: "right" },
    "me->terraform": { at: 0.5, side: "below", dy: 30 },
    "terraform->digitalocean": { at: 0.7, side: "left" },
    "digitalocean->droplet": { at: 0.4, side: "left" },
    "terraform->grafana": { at: 0.5, side: "left" },
  },
};

export const deployGraph: Graph = {
  description:
    "Build and deploy: I push to the app repos on GitHub, where Actions tests them and builds images to GHCR, then triggers infra's deploy, which runs Ansible on the droplet to pull and start them. Terraform provisions the droplet and DNS at DigitalOcean, and the uptime checks in Grafana Cloud.",
  casingLabel: "GitHub",
  nodes,
  edges,
  layouts: { landscape: landscapeLayout, portrait: portraitLayout },
  details: deployDetails,
  traceGroups: deployTraceGroups,
};
