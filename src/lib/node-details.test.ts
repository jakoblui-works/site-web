import { describe, expect, it } from "vitest";

import { nodes } from "./infra-graph";
import { nodeDetails } from "./node-details";

describe("node details", () => {
  it("explains every node in the graph, and only those", () => {
    expect(Object.keys(nodeDetails).sort()).toEqual(
      nodes.map((node) => node.id).sort(),
    );
  });

  it("gives every node a summary and only absolute links", () => {
    for (const [id, details] of Object.entries(nodeDetails)) {
      expect(details.summary.trim(), id).not.toBe("");
      for (const link of details.links) {
        expect(() => new URL(link.url), `${id}: ${link.url}`).not.toThrow();
      }
    }
  });
});
