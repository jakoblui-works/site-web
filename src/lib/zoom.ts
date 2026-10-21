/**
 * Zooming the x-ray in: into one node (the camera flies in until its outline frames the stage, the
 * window's clear area, and its internals, drawn inside it, grow into view), or onto a group of
 * traces (framed, with its notes printed on the board beside it). Screen values are px in the
 * stage's coordinate space; graph sizes are in viewBox units.
 */

import type { GraphLayout, Point, Rect } from "./infra-graph";

/** A CSS transform on the graph, with its origin at the stage's top-left: translate, then scale. */
export type Camera = Point & { scale: number };
export type Size = { width: number; height: number };

export const IDENTITY: Camera = { x: 0, y: 0, scale: 1 };

/** How wide the internals are laid out, at most (px): wider lines are hard to read. */
const MAX_CONTENT_WIDTH = 820;
/** How much of the stage's width the internals take once inside, where there's room to scale them up. */
const CONTENT_SHARE = 0.75;
/** How much of the stage's height they may take when scaled up. */
const MAX_CONTENT_HEIGHT_SHARE = 0.9;
/**
 * How far inside a node's edge its border ends (units): half the selected node's stroke (2, see
 * `InfraGraph`), which is centred on the edge. The internals stay inside it, scrolling too.
 */
export const NODE_BORDER = 1;

/** How large one viewBox unit is with the whole graph fitted (`preserveAspectRatio="xMidYMid meet"`). */
export const fitScale = (layout: GraphLayout, stage: Size) =>
  Math.min(stage.width / layout.width, stage.height / layout.height);

/** Where a viewBox point lands in the stage, before zooming. */
export const toStage = (layout: GraphLayout, stage: Rect, point: Point): Point => {
  const scale = fitScale(layout, stage);
  return {
    x: stage.x + (stage.width - layout.width * scale) / 2 + point.x * scale,
    y: stage.y + (stage.height - layout.height * scale) / 2 + point.y * scale,
  };
};

/** Where a point lands under the camera. */
export const throughCamera = (camera: Camera, point: Point, origin: Point): Point => ({
  x: origin.x + camera.x + camera.scale * (point.x - origin.x),
  y: origin.y + camera.y + camera.scale * (point.y - origin.y),
});

/** How wide the internals are laid out (px), to measure them before planning (unscaled). */
export const contentWidth = (stage: Size) => Math.min(stage.width, MAX_CONTENT_WIDTH);

export type ZoomPlan = {
  id: string;
  stage: Rect;
  /** The centre of what's zoomed into (a node, or a group of traces), in the stage before zooming. */
  centre: Point;
  /** px per unit before zooming. */
  fit: number;
  /** The size of what's zoomed into (units). */
  target: Size;
  /** The camera when the zoom starts, and once zoomed in. */
  from: Camera;
  to: Camera;
  /** Where the content is once zoomed in (px): a node's internals, or a group's notes. */
  content: Rect;
  /**
   * How large the internals are drawn once inside, relative to their layout: on big screens they
   * scale up with the node, so they take the same share of it as on a laptop.
   */
  contentZoom: number;
  /**
   * Whether the content is taller than its place once inside (more than a px: the browser's own
   * rounding mustn't decide), so it scrolls there.
   */
  overflows: boolean;
};

/** The camera at `scale` that puts the stage point `centre` (before zooming) at `at`. */
const cameraPutting = (centre: Point, at: Point, scale: number, stage: Rect): Camera => ({
  x: at.x - stage.x - scale * (centre.x - stage.x),
  y: at.y - stage.y - scale * (centre.y - stage.y),
  scale,
});

/**
 * Plans zooming into a node whose internals are `contentHeight` px tall at `contentWidth`. Inside,
 * the node is at least as wide as the stage (its sides fade into the window's edge) and tall enough
 * for its internals, up to the stage's height (then they scroll). The internals scale up to a
 * share of the stage's width where they fit its height.
 */
export const planZoom = (
  layout: GraphLayout,
  id: string,
  stage: Rect,
  contentHeight: number,
  from: Camera = IDENTITY,
): ZoomPlan => {
  const fit = fitScale(layout, stage);
  const centre = toStage(layout, stage, layout.positions[id]);
  const { node } = layout;
  const layoutWidth = contentWidth(stage);
  const contentZoom = Math.max(
    1,
    Math.min(
      (CONTENT_SHARE * stage.width) / layoutWidth,
      (MAX_CONTENT_HEIGHT_SHARE * stage.height) / contentHeight,
    ),
  );
  // Tall enough for the internals inside its border, up to the stage's height.
  const pxPerUnit = Math.max(
    stage.width / node.width,
    Math.min(
      (contentHeight * contentZoom) / (node.height - 2 * NODE_BORDER),
      stage.height / node.height,
    ),
  );
  const scale = pxPerUnit / fit;
  const height = node.height * pxPerUnit;
  const border = NODE_BORDER * pxPerUnit;
  const width = layoutWidth * contentZoom;
  return {
    id,
    stage,
    centre,
    fit,
    target: node,
    from,
    // The node's centre lands on the stage's centre.
    to: cameraPutting(
      centre,
      { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 },
      scale,
      stage,
    ),
    content: {
      x: stage.x + (stage.width - width) / 2,
      y: stage.y + (stage.height - height) / 2 + border,
      width,
      height: height - 2 * border,
    },
    contentZoom,
    overflows: contentHeight * contentZoom > height - 2 * border + 1,
  };
};

/** How far in framing a group of traces may zoom, at most (px per unit): small groups stay in context. */
const MAX_FRAME_PX_PER_UNIT = 2.4;
/** Room kept around a framed group of traces, for its labels (px). */
const FRAME_MARGIN = 96;

/** Room kept above and below a framed group on narrow stages, where it may crop at the sides (px). */
const NARROW_MARGIN = 48;

/**
 * Plans framing an area of the graph (a group of traces, in units): centred in the stage with room
 * around it for the traces' labels. The camera never zooms out. With `crop` above 1 (narrow stages,
 * where the graph is small), the area may be up to that many stage widths wide: it's framed closer
 * and cropped at the sides, so its labels have room.
 */
export const planFrameZoom = (
  layout: GraphLayout,
  id: string,
  area: Rect,
  stage: Rect,
  from: Camera = IDENTITY,
  crop = 1,
): ZoomPlan => {
  const fit = fitScale(layout, stage);
  const centre = toStage(layout, stage, {
    x: area.x + area.width / 2,
    y: area.y + area.height / 2,
  });
  const pxPerUnit = Math.max(
    fit,
    crop > 1
      ? Math.min(
          MAX_FRAME_PX_PER_UNIT,
          (crop * stage.width) / area.width,
          (stage.height - 2 * NARROW_MARGIN) / area.height,
        )
      : Math.min(
          MAX_FRAME_PX_PER_UNIT,
          (stage.width - 2 * FRAME_MARGIN) / area.width,
          (stage.height - 2 * FRAME_MARGIN) / area.height,
        ),
  );
  return {
    id,
    stage,
    centre,
    fit,
    target: { width: area.width, height: area.height },
    from,
    to: cameraPutting(
      centre,
      { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 },
      pxPerUnit / fit,
      stage,
    ),
    // The labels are placed on the scene itself (hand-placed per layout), not in a block of content.
    content: stage,
    contentZoom: 1,
    overflows: false,
  };
};

/** Which side of its anchor a label sits on, and how far from it (px). */
export type LabelPlacement = { side: "above" | "below" | "left" | "right"; offset: number };

/** Where a label at `anchor`, placed as `placement`, is on screen. */
export const labelRect = (anchor: Point, size: Size, { side, offset }: LabelPlacement): Rect => {
  switch (side) {
    case "above":
      return { x: anchor.x - size.width / 2, y: anchor.y - offset - size.height, ...size };
    case "below":
      return { x: anchor.x - size.width / 2, y: anchor.y + offset, ...size };
    case "left":
      return { x: anchor.x - offset - size.width, y: anchor.y - size.height / 2, ...size };
    case "right":
      return { x: anchor.x + offset, y: anchor.y - size.height / 2, ...size };
  }
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * One frame of the zoom, at `t` from 0 (the overview, under `from`) to 1 (zoomed in). The zoom is
 * geometric, so it feels steady however deep it goes, and the target's centre glides straight to
 * where it ends. Returns the camera, the target and the content on screen, and how large the content
 * is drawn relative to its layout (it's part of the zoomed scene).
 */
export const zoomFrame = (plan: ZoomPlan, t: number) => {
  const { stage, centre, from, to } = plan;
  const scale = from.scale * (to.scale / from.scale) ** t;
  const start = throughCamera(from, centre, stage);
  const end = throughCamera(to, centre, stage);
  const at = { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) };
  const pxPerUnit = plan.fit * scale;
  const contentScale = scale / to.scale;
  // The content moves with the scene: its offset from the target's centre scales with the zoom.
  return {
    camera: cameraPutting(centre, at, scale, stage),
    target: {
      x: at.x - (plan.target.width * pxPerUnit) / 2,
      y: at.y - (plan.target.height * pxPerUnit) / 2,
      width: plan.target.width * pxPerUnit,
      height: plan.target.height * pxPerUnit,
    } satisfies Rect,
    content: {
      x: at.x + (plan.content.x - end.x) * contentScale,
      y: at.y + (plan.content.y - end.y) * contentScale,
      width: plan.content.width * contentScale,
      height: plan.content.height * contentScale,
    } satisfies Rect,
    contentScale: contentScale * plan.contentZoom,
  };
};

/** Ease in and out, symmetric, so zooming out retraces zooming in. */
export const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** The `t` at which `ease` reaches `eased`: for scrubbing the zoom evenly with a gesture. */
export const easeInverse = (eased: number) =>
  eased < 0.5 ? Math.cbrt(eased / 4) : 1 - Math.cbrt(2 * (1 - eased)) / 2;

/** 0 before `from`, 1 after `to`, smooth between: for fading things with the zoom. */
export const ramp = (t: number, from: number, to: number) => {
  const x = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return x * x * (3 - 2 * x);
};
