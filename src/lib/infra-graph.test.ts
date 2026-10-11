import { describe, expect, it } from "vitest";

import {
  edgeId,
  edges,
  landscapeLayout,
  nodes,
  portraitLayout,
  type GraphLayout,
  type Point,
  type Rect,
} from "./infra-graph";

const layouts = { landscape: landscapeLayout, portrait: portraitLayout };

const nodeBox = (layout: GraphLayout, id: string): Rect => {
  const { x, y } = layout.positions[id];
  const { width, height } = layout.node;
  return { x: x - width / 2, y: y - height / 2, width, height };
};

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/** Whether the segment a→b passes through the rectangle (Liang–Barsky clipping). */
const segmentHitsRect = (a: Point, b: Point, r: Rect) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
};

describe("infra graph data", () => {
  it("has unique node ids", () => {
    const ids = nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only connects nodes that exist, each pair once", () => {
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of edges) {
      expect(ids).toContain(edge.from);
      expect(ids).toContain(edge.to);
    }
    const edgeIds = edges.map(edgeId);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });
});

describe.each(Object.entries(layouts))("%s layout", (_, layout) => {
  const viewBox: Rect = { x: 0, y: 0, width: layout.width, height: layout.height };

  it("places every node, and nothing else", () => {
    expect(Object.keys(layout.positions).sort()).toEqual(
      nodes.map((node) => node.id).sort(),
    );
  });

  it("keeps the casing and every node inside the view", () => {
    expect(contains(viewBox, layout.casing)).toBe(true);
    for (const node of nodes) {
      expect(contains(viewBox, nodeBox(layout, node.id)), node.id).toBe(true);
    }
  });

  it("draws droplet nodes inside the casing and the rest fully outside it", () => {
    for (const node of nodes) {
      const box = nodeBox(layout, node.id);
      if (node.inDroplet) {
        expect(contains(layout.casing, box), node.id).toBe(true);
      } else {
        expect(overlaps(layout.casing, box), node.id).toBe(false);
      }
    }
  });

  it("doesn't overlap nodes", () => {
    for (const [i, a] of nodes.entries()) {
      for (const b of nodes.slice(i + 1)) {
        expect(
          overlaps(nodeBox(layout, a.id), nodeBox(layout, b.id)),
          `${a.id} / ${b.id}`,
        ).toBe(false);
      }
    }
  });

  it("doesn't run an edge through a node it doesn't connect", () => {
    for (const edge of edges) {
      const from = layout.positions[edge.from];
      const to = layout.positions[edge.to];
      for (const node of nodes) {
        if (node.id === edge.from || node.id === edge.to) continue;
        expect(
          segmentHitsRect(from, to, nodeBox(layout, node.id)),
          `${edgeId(edge)} crosses ${node.id}`,
        ).toBe(false);
      }
    }
  });
});
