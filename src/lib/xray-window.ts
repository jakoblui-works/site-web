/** The x-ray's window: where the interior shows through the surface's frost (see `useXrayWindow`). */

/** How far the window's edge takes to turn from frost into clear glass (px). */
export const BAND = 96;

/** Edges in viewport px. */
export type Box = { left: number; top: number; right: number; bottom: number };

type Screen = {
  width: number;
  height: number;
  /** The graph's clear area (where it's fitted), as margins from the screen's edges. */
  clear: { x: number; y: number };
  /** The hero's content, in viewport px. */
  hero: Box;
  /** The header's height. */
  header: number;
};

/**
 * The window's shape: a rounded rectangle (`shape`, corner `radius`), blurred so that its edge
 * fades over `BAND`, centred on the rectangle's edge. Fully clear over the graph's clear area and
 * the hero, so the hero is always hidden behind the interior rather than cut off on the frost, and
 * from half a band below the header (or the clear area's top, if higher), so the fade reaches into
 * the header. A side that comes within a band of the screen's edge runs off it, corners and fade
 * too, so that side has no frost at all (phones, and narrow screens where the hero is near the
 * edge). The top never does: the header always stands on the frost.
 */
export const xrayWindow = ({ width, height, clear, hero, header }: Screen) => {
  const radius = 0.18 * Math.min(width, height);
  const area: Box = {
    left: Math.max(0, Math.min(clear.x, hero.left)),
    right: Math.min(width, Math.max(width - clear.x, hero.right)),
    top: Math.max(0, Math.min(clear.y, header + BAND / 2, hero.top)),
    bottom: Math.min(height, Math.max(height - clear.y, hero.bottom)),
  };
  const off = radius + BAND;
  const shape: Box = {
    left: area.left < BAND ? -off : area.left - BAND / 2,
    right: width - area.right < BAND ? width + off : area.right + BAND / 2,
    top: area.top - BAND / 2,
    bottom: height - area.bottom < BAND ? height + off : area.bottom + BAND / 2,
  };
  return { shape, radius };
};
