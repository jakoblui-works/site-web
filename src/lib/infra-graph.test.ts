import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { graphs } from "./graphs";
import {
  edgeId,
  edgeRoute,
  GRID,
  segmentHitsRect,
  type GraphEdge,
  type GraphLayout,
  type Rect,
} from "./infra-graph";

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

describe.each(Object.entries(graphs))("%s graph", (_, { nodes, edges, layouts }) => {
  describe("data", () => {
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

    it("draws casing nodes inside the casing and the rest fully outside it", () => {
      for (const node of nodes) {
        const box = nodeBox(layout, node.id);
        if (node.inCasing) {
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

    it("doesn't run an edge's route through a node it doesn't connect", () => {
      for (const edge of edges) {
        const route = edgeRoute(layout, edge);
        for (const node of nodes) {
          if (node.id === edge.from || node.id === edge.to) continue;
          for (const [i, point] of route.slice(1).entries()) {
            expect(
              segmentHitsRect(route[i], point, nodeBox(layout, node.id)),
              `${edgeId(edge)} crosses ${node.id}`,
            ).toBe(false);
          }
        }
      }
    });

    it("spread only names traces into that node", () => {
      const ids = new Set(nodes.map((node) => node.id));
      for (const [target, listed] of Object.entries(layout.spread ?? {})) {
        expect(ids, `spread key ${target}`).toContain(target);
        const into = edges.filter((edge) => edge.to === target).map(edgeId);
        for (const id of listed) {
          expect(into, `spread ${target}: ${id}`).toContain(id);
        }
        expect(new Set(listed).size, `spread ${target} has duplicates`).toBe(listed.length);
      }
    });

    it("routes every edge like a board trace: straight or at 45°", () => {
      for (const edge of edges) {
        const route = edgeRoute(layout, edge);
        for (const [i, point] of route.slice(1).entries()) {
          const dx = Math.abs(point.x - route[i].x);
          const dy = Math.abs(point.y - route[i].y);
          expect(
            dx === 0 || dy === 0 || Math.abs(dx - dy) < 1e-9,
            `${edgeId(edge)} segment ${i}`,
          ).toBe(true);
        }
      }
    });
  });
});

describe("spread entries", () => {
  type Side = "top" | "bottom" | "left" | "right";
  const target = { x: 2000, y: 2000 };
  // Grid steps from the target: `lead` along the axis it's entered on (always on that side), `lateral`
  // across it (anywhere).
  const source = fc.record({
    lead: fc.integer({ min: 1, max: 40 }),
    lateral: fc.integer({ min: -40, max: 40 }),
  });
  const setup = fc.record({
    side: fc.constantFrom<Side>("top", "bottom", "left", "right"),
    node: fc.record({
      width: fc.integer({ min: 6, max: 12 }).map((n) => n * GRID - 10),
      height: fc.integer({ min: 2, max: 5 }).map((n) => n * GRID),
    }),
    sources: fc.array(source, { minLength: 2, maxLength: 4 }),
  });

  it("shares a side out evenly, in the listed order, with board traces", () => {
    fc.assert(
      fc.property(setup, ({ side, node, sources }) => {
        const enter = side === "top" || side === "bottom" ? "y" : "x";
        const sign = side === "top" || side === "left" ? -1 : 1;
        const positions: GraphLayout["positions"] = { target };
        const edges: GraphEdge[] = sources.map(({ lead, lateral }, i) => {
          const id = `s${i}`;
          const along = target[enter === "x" ? "x" : "y"] + sign * lead * GRID;
          const across = target[enter === "x" ? "y" : "x"] + lateral * GRID;
          positions[id] = enter === "x" ? { x: along, y: across } : { x: across, y: along };
          return { from: id, to: "target" };
        });
        const layout: GraphLayout = {
          width: 4000,
          height: 4000,
          node,
          casing: { x: 0, y: 0, width: 4000, height: 4000 },
          positions,
          routes: Object.fromEntries(edges.map((edge) => [edgeId(edge), { enter }])),
          spread: { target: edges.map(edgeId) },
        };
        const n = edges.length;
        const left = target.x - node.width / 2;
        const top = target.y - node.height / 2;

        for (const [k, edge] of edges.entries()) {
          const route = edgeRoute(layout, edge);
          const end = route[route.length - 1];
          const share = (k + 1) / (n + 1);
          const expected =
            side === "top" || side === "bottom"
              ? { x: left + node.width * share, y: target.y + (sign * node.height) / 2 }
              : { x: target.x + (sign * node.width) / 2, y: top + node.height * share };
          expect(end.x, `${edgeId(edge)} end x`).toBeCloseTo(expected.x, 6);
          expect(end.y, `${edgeId(edge)} end y`).toBeCloseTo(expected.y, 6);

          for (const [i, point] of route.slice(1).entries()) {
            const dx = Math.abs(point.x - route[i].x);
            const dy = Math.abs(point.y - route[i].y);
            expect(
              dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-9,
              `${edgeId(edge)} segment ${i}`,
            ).toBe(true);
          }
        }
      }),
    );
  });
});
