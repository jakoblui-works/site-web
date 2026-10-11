import type { Graph } from "@/lib/infra-graph";

import { deployGraph } from "./deploy";
import { runtimeGraph } from "./runtime";

/** The x-ray's views, by id. */
export const graphs = {
  runtime: runtimeGraph,
  deploy: deployGraph,
} satisfies Record<string, Graph>;

export type GraphId = keyof typeof graphs;

export const graphIds = Object.keys(graphs) as GraphId[];

/** What the x-ray's view switch calls each view. */
export const graphTitles: Record<GraphId, string> = {
  runtime: "Runtime",
  deploy: "Build & deploy",
};
