import { describe, expect, it } from "vitest";

import { landscapeLayout, nodes, portraitLayout, type Rect } from "./infra-graph";
import { traceArea, traceGroups } from "./trace-groups";
import {
  ease,
  easeInverse,
  IDENTITY,
  labelRect,
  planFrameZoom,
  planZoom,
  ramp,
  toStage,
  zoomFrame,
} from "./zoom";

/** Stages (the window's clear area) on a laptop, a big monitor, a tablet and a phone. */
const screens = {
  laptop: { stage: { x: 173, y: 108, width: 1094, height: 684 }, layout: landscapeLayout },
  monitor: { stage: { x: 307, y: 130, width: 1946, height: 1180 }, layout: landscapeLayout },
  qhd: { stage: { x: 307, y: 173, width: 1946, height: 1094 }, layout: landscapeLayout },
  tablet: { stage: { x: 61, y: 112, width: 646, height: 800 }, layout: portraitLayout },
  phone: { stage: { x: 31, y: 93, width: 328, height: 658 }, layout: portraitLayout },
} as const;

/** Short and long internals (the long ones scroll). */
const contentHeights = [240, 4000];
const steps = Array.from({ length: 11 }, (_, i) => i / 10);
const EPS = 1e-6;

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  inner.x + inner.width <= outer.x + outer.width + EPS &&
  inner.y + inner.height <= outer.y + outer.height + EPS;

describe.each(Object.entries(screens))("zooming into a node on a %s", (_, { stage, layout }) => {
  it("starts from the overview, with the node exactly as the graph draws it", () => {
    for (const node of nodes) {
      const { camera, target: rect } = zoomFrame(planZoom(layout, node.id, stage, 400), 0);
      expect(camera).toEqual(IDENTITY);
      const { x, y } = layout.positions[node.id];
      const topLeft = toStage(layout, stage, {
        x: x - layout.node.width / 2,
        y: y - layout.node.height / 2,
      });
      expect(rect.x).toBeCloseTo(topLeft.x);
      expect(rect.y).toBeCloseTo(topLeft.y);
    }
  });

  it.each(contentHeights)("ends inside the node, framing %ipx of internals", (height) => {
    for (const node of nodes) {
      const { target: rect, content } = zoomFrame(planZoom(layout, node.id, stage, height), 1);
      // Centred, with its sides at or past the stage's edges and its top and bottom on stage.
      expect(rect.x + rect.width / 2).toBeCloseTo(stage.x + stage.width / 2);
      expect(rect.y + rect.height / 2).toBeCloseTo(stage.y + stage.height / 2);
      expect(rect.width).toBeGreaterThanOrEqual(stage.width - EPS);
      expect(rect.height).toBeLessThanOrEqual(stage.height + EPS);
      // The internals fill it top to bottom (or scroll), on stage.
      expect(inside(content, stage), node.id).toBe(true);
      expect(content.height).toBeCloseTo(rect.height);
    }
  });

  it("keeps the internals inside the node all the way in", () => {
    for (const node of nodes) {
      const plan = planZoom(layout, node.id, stage, 600);
      for (const t of steps) {
        const frame = zoomFrame(plan, ease(t));
        expect(inside(frame.content, frame.target), `${node.id} at ${t}`).toBe(true);
      }
    }
  });

  it("only ever zooms in, and the internals grow with it", () => {
    const plan = planZoom(layout, "api", stage, 400);
    const frames = steps.map((t) => zoomFrame(plan, ease(t)));
    for (const [i, frame] of frames.slice(1).entries()) {
      expect(frame.camera.scale).toBeGreaterThanOrEqual(frames[i].camera.scale);
      expect(frame.contentScale).toBeGreaterThanOrEqual(frames[i].contentScale);
    }
    expect(frames.at(-1)?.contentScale).toBeCloseTo(plan.contentZoom);
  });

  it("can start from a camera that's already zoomed", () => {
    const from = { x: -120, y: 40, scale: 1.7 };
    expect(zoomFrame(planZoom(layout, "api", stage, 400, from), 0).camera).toEqual(from);
  });
});

describe.each(Object.entries(screens))("framing a group of traces on a %s", (_, { stage, layout }) => {
  it("zooms in on it, centred, never further out than the overview", () => {
    for (const group of traceGroups) {
      const plan = planFrameZoom(layout, group.id, traceArea(layout, group), stage);
      expect(zoomFrame(plan, 0).camera).toEqual(IDENTITY);
      const { target } = zoomFrame(plan, 1);
      expect(plan.to.scale, group.id).toBeGreaterThanOrEqual(1 - EPS);
      expect(target.x + target.width / 2).toBeCloseTo(stage.x + stage.width / 2);
      expect(target.y + target.height / 2).toBeCloseTo(stage.y + stage.height / 2);
      // Wherever the camera could get closer than the overview, the whole group is on stage.
      if (plan.to.scale > 1 + EPS) expect(inside(target, stage), group.id).toBe(true);
    }
  });

  it("frames closer when allowed to crop, keeping the group's height on stage", () => {
    for (const group of traceGroups) {
      const area = traceArea(layout, group);
      const plain = planFrameZoom(layout, group.id, area, stage);
      const cropped = planFrameZoom(layout, group.id, area, stage, IDENTITY, 1.4);
      expect(cropped.to.scale, group.id).toBeGreaterThanOrEqual(plain.to.scale - EPS);
      const { target } = zoomFrame(cropped, 1);
      expect(target.width, group.id).toBeLessThanOrEqual(1.4 * stage.width + EPS);
      if (cropped.to.scale > 1 + EPS) {
        expect(target.y, group.id).toBeGreaterThanOrEqual(stage.y - EPS);
        expect(target.y + target.height, group.id).toBeLessThanOrEqual(stage.y + stage.height + EPS);
      }
    }
  });
});

describe("a label's place on screen", () => {
  it("puts each side's label on that side of its anchor, that far away", () => {
    const anchor = { x: 100, y: 100 };
    const size = { width: 160, height: 32 };
    expect(labelRect(anchor, size, { side: "above", offset: 8 }).y + size.height).toBe(anchor.y - 8);
    expect(labelRect(anchor, size, { side: "below", offset: 8 }).y).toBe(anchor.y + 8);
    expect(labelRect(anchor, size, { side: "left", offset: 8 }).x + size.width).toBe(anchor.x - 8);
    expect(labelRect(anchor, size, { side: "right", offset: 8 }).x).toBe(anchor.x + 8);
  });
});

describe("internals on bigger screens", () => {
  it("take the same share of the node on a laptop and a big monitor, scaled up to fit", () => {
    const share = (stage: Rect) => {
      const { target, content } = zoomFrame(planZoom(landscapeLayout, "api", stage, 330), 1);
      return content.width / Math.min(target.width, stage.width);
    };
    expect(share(screens.qhd.stage)).toBeCloseTo(share(screens.laptop.stage), 2);
    expect(planZoom(landscapeLayout, "api", screens.qhd.stage, 330).contentZoom).toBeGreaterThan(1);
  });

  it("aren't scaled up past the stage's height", () => {
    const stage = screens.qhd.stage;
    const plan = planZoom(landscapeLayout, "api", stage, 1000);
    expect(1000 * plan.contentZoom).toBeLessThanOrEqual(stage.height);
  });
});

describe("easing", () => {
  it("runs from 0 to 1, symmetric, so zooming out retraces zooming in", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    for (const t of steps) expect(ease(1 - t)).toBeCloseTo(1 - ease(t));
  });

  it("can be undone, so a gesture can scrub the zoom evenly", () => {
    for (const t of steps) expect(easeInverse(ease(t))).toBeCloseTo(t);
  });

  it("ramps from 0 to 1 between its bounds", () => {
    expect(ramp(0.1, 0.2, 0.6)).toBe(0);
    expect(ramp(0.7, 0.2, 0.6)).toBe(1);
    for (const [i, t] of steps.slice(1).entries()) {
      expect(ramp(t, 0.2, 0.6)).toBeGreaterThanOrEqual(ramp(steps[i], 0.2, 0.6));
    }
  });
});
