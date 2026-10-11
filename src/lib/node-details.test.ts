import { describe, expect, it } from "vitest";

import { graphs } from "./graphs";

describe.each(Object.entries(graphs))("%s graph's node details", (_, { nodes, details }) => {
  it("explain every node in the graph, and only those", () => {
    expect(Object.keys(details).sort()).toEqual(
      nodes.map((node) => node.id).sort(),
    );
  });

  it("give every node a summary and only absolute links", () => {
    for (const [id, node] of Object.entries(details)) {
      expect(node.summary.trim(), id).not.toBe("");
      for (const link of node.links) {
        expect(() => new URL(link.url), `${id}: ${link.url}`).not.toThrow();
      }
    }
  });
});
