import type { Graph } from "@/lib/infra-graph";

import { deployGraph } from "./deploy";
import { runtimeGraph } from "./runtime";

/** The x-ray's views, by id. */
export const graphs = {
  runtime: runtimeGraph,
  deploy: deployGraph,
} satisfies Record<string, Graph>;

export type GraphId = keyof typeof graphs;
