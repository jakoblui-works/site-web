import { describe, expect, it } from "vitest";

import {
  edgeId,
  edgeRoute,
  edges,
  labelAnchor,
  segmentHitsRect,
  landscapeLayout,
  nodes,
  portraitLayout,
  type GraphLayout,
  type Rect,
} from "./infra-graph";
import { LABEL_STYLE, NARROW_CROP, traceArea, traceGroupOf, traceGroups } from "./trace-groups";
import { labelRect, planFrameZoom, throughCamera, toStage } from "./zoom";

/** Stages (the window's clear area) where groups are zoomed into: wide screens and narrow ones. */
const screens = {
  laptop: { stage: { x: 173, y: 108, width: 1094, height: 684 }, layout: landscapeLayout, narrow: false },
  qhd: { stage: { x: 307, y: 173, width: 1946, height: 1094 }, layout: landscapeLayout, narrow: false },
  tablet: { stage: { x: 61, y: 112, width: 646, height: 800 }, layout: portraitLayout, narrow: true },
  phone: { stage: { x: 31, y: 93, width: 328, height: 658 }, layout: portraitLayout, narrow: true },
} as const;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/**
 * Where a group's labels and nodes are on screen once zoomed in. Label sizes are estimated from
 * their text (the font is mono), as `TraceLabels` sets them.
 */
const zoomedIn = (layout: GraphLayout, stage: Rect, narrow: boolean, groupId: string) => {
  const group = traceGroups.find((candidate) => candidate.id === groupId)!;
  const plan = planFrameZoom(
    layout,
    group.id,
    traceArea(layout, group),
    stage,
    undefined,
    narrow ? NARROW_CROP : 1,
  );
  const pxPerUnit = plan.fit * plan.to.scale;
  const onScreen = (point: { x: number; y: number }) =>
    throughCamera(plan.to, toStage(layout, stage, point), stage);
  const fontSize = narrow ? LABEL_STYLE.fontSize.narrow : LABEL_STYLE.fontSize.wide;
  const labels = edges
    .filter((edge) => group.edges.includes(edgeId(edge)))
    .map((edge) => {
      const spot = layout.labels?.[edgeId(edge)];
      const lines = group.labels[edgeId(edge)].slice(0, narrow ? 1 : undefined);
      const size = {
        width: Math.max(...lines.map((line) => line.length)) * LABEL_STYLE.charWidth * fontSize,
        height: lines.length * LABEL_STYLE.lineHeight * fontSize,
      };
      const offset =
        LABEL_STYLE.offset + (spot?.clear ? (layout.node.height / 2) * pxPerUnit : 0);
      return {
        edge: edgeId(edge),
        spot,
        rect: spot && labelRect(onScreen(labelAnchor(layout, edge, spot)), size, { side: spot.side, offset }),
      };
    });
  const groupNodes = new Set(group.edges.flatMap((id) => id.split("->")));
  const { width, height } = layout.node;
  const nodeRects = [...groupNodes].map((id) => {
    const { x, y } = layout.positions[id];
    const a = onScreen({ x: x - width / 2, y: y - height / 2 });
    const b = onScreen({ x: x + width / 2, y: y + height / 2 });
    return { id, rect: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y } };
  });
  // The group's traces on screen, as segments.
  const segments = edges
    .filter((edge) => group.edges.includes(edgeId(edge)))
    .flatMap((edge) => {
      const route = edgeRoute(layout, edge).map(onScreen);
      return route.slice(1).map((point, i) => ({ edge: edgeId(edge), a: route[i], b: point }));
    });
  return { labels, nodeRects, segments };
};

describe("trace groups", () => {
  it("put every trace in exactly one group", () => {
    for (const edge of edges) {
      const groups = traceGroups.filter((group) => group.edges.includes(edgeId(edge)));
      expect(groups, edgeId(edge)).toHaveLength(1);
      expect(traceGroupOf(edgeId(edge))).toBe(groups[0]);
    }
  });

  it("only name traces that exist", () => {
    const ids = edges.map(edgeId);
    for (const group of traceGroups) {
      expect(group.edges.length, group.id).toBeGreaterThan(0);
      for (const id of group.edges) expect(ids, group.id).toContain(id);
    }
  });

  it("have ids of their own, apart from the nodes' (they share the URL)", () => {
    const ids = traceGroups.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of nodes) expect(ids).not.toContain(node.id);
  });

  it("label every one of their traces, and only those, in a line or two", () => {
    for (const group of traceGroups) {
      expect(group.title.trim(), group.id).not.toBe("");
      expect(Object.keys(group.labels).sort(), group.id).toEqual([...group.edges].sort());
      for (const [edge, lines] of Object.entries(group.labels)) {
        expect(lines.length, edge).toBeGreaterThanOrEqual(1);
        expect(lines.length, edge).toBeLessThanOrEqual(2);
        for (const line of lines) expect(line.trim(), edge).not.toBe("");
      }
    }
  });

  it.each([landscapeLayout, portraitLayout])("cover their traces and the parts they connect", (layout) => {
    for (const group of traceGroups) {
      const area = traceArea(layout, group);
      for (const id of group.edges) {
        const [from, to] = id.split("->");
        for (const node of [from, to]) {
          const { x, y } = layout.positions[node];
          expect(x, `${group.id}: ${node}`).toBeGreaterThanOrEqual(area.x);
          expect(x).toBeLessThanOrEqual(area.x + area.width);
          expect(y).toBeGreaterThanOrEqual(area.y);
          expect(y).toBeLessThanOrEqual(area.y + area.height);
        }
      }
    }
  });
});

describe.each(Object.entries(screens))("trace labels on a %s", (_, { stage, layout, narrow }) => {
  it.each(traceGroups.map((group) => group.id))("%s: each trace has a spot, clear of its parts, its traces, each other and on screen", (groupId) => {
    const { labels, nodeRects, segments } = zoomedIn(layout, stage, narrow, groupId);
    for (const { edge, spot, rect } of labels) {
      expect(spot, `${edge} has no label spot in this layout`).toBeDefined();
      if (!rect) continue;
      expect(inside(rect, stage), `${edge} runs off screen`).toBe(true);
      for (const node of nodeRects) {
        expect(overlaps(rect, node.rect), `${edge} covers ${node.id}`).toBe(false);
      }
      // No trace runs through the text (with a few px of breathing room).
      const padded = { x: rect.x - 3, y: rect.y - 3, width: rect.width + 6, height: rect.height + 6 };
      for (const segment of segments) {
        expect(segmentHitsRect(segment.a, segment.b, padded), `${edge} label crosses ${segment.edge}`).toBe(false);
      }
    }
    for (const [i, a] of labels.entries()) {
      for (const b of labels.slice(i + 1)) {
        if (a.rect && b.rect) {
          expect(overlaps(a.rect, b.rect), `${a.edge} and ${b.edge} overlap`).toBe(false);
        }
      }
    }
  });
});
