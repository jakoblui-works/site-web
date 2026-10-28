/**
 * The 404 page's picture: the start of the runtime graph's request path (you, DNS, Traefik), with
 * nowhere for Traefik to send the request. Its own small layouts; the parts are the real ones.
 */

import type { Graph, GraphLayout } from "@/lib/infra-graph";

import { runtimeGraph } from "./runtime";

const parts = ["browser", "dns", "traefik"];
const requestPath = runtimeGraph.traceGroups.filter((group) => group.id === "request-path");

/** Wide screens: as in the runtime graph, DNS above you, and Traefik to the right in the droplet. */
const landscape: GraphLayout = {
  width: 700,
  height: 320,
  node: { width: 170, height: 60 },
  casing: { x: 200, y: 120, width: 480, height: 180 },
  positions: {
    dns: { x: 100, y: 60 },
    browser: { x: 100, y: 220 },
    traefik: { x: 360, y: 220 },
  },
};

/**
 * Phones: top to bottom, as in the runtime graph's portrait layout, but with Traefik straight below
 * you, so the trace runs clear of the casing's label.
 */
const portrait: GraphLayout = {
  width: 420,
  height: 420,
  node: { width: 170, height: 58 },
  casing: { x: 20, y: 140, width: 380, height: 260 },
  positions: {
    dns: { x: 100, y: 60 },
    browser: { x: 300, y: 60 },
    traefik: { x: 300, y: 200 },
  },
};

export const notFoundGraph: Graph = {
  // Drawn decoratively: the page says what it shows in text.
  description: "",
  casingLabel: runtimeGraph.casingLabel,
  nodes: runtimeGraph.nodes.filter((node) => parts.includes(node.id)),
  edges: runtimeGraph.edges.filter((edge) => parts.includes(edge.from) && parts.includes(edge.to)),
  layouts: { landscape, portrait },
  details: {},
  traceGroups: requestPath,
};
