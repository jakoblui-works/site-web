/** The x-ray's window: where the interior shows through the surface's frost (see `useXrayWindow`). */

/**
 * How far the window's edge takes to turn from frost into clear glass (px). Shorter on phones,
 * where the header's items and the hero are too close together for the longer one to fit between.
 */
export const bandFor = (width: number) => (width < 640 ? 56 : 96);

/**
 * How far up from the screen's bottom edge the window may be clear: a band to fade, and half a band
 * of solid frost below it. The graph's clear area keeps above it (see `useXrayWindow`).
 */
export const bottomFrost = (band: number) => 1.5 * band;

/** Edges in viewport px. */
export type Box = { left: number; top: number; right: number; bottom: number };

type Screen = {
  width: number;
  height: number;
  /** The graph's clear area (where it's fitted), as margins from the screen's edges. */
  clear: { x: number; y: number; bottom: number };
  /** The hero's content, in viewport px. */
  hero: Box;
  /** The header's height. */
  header: number;
  /** The header's items (the logo, the work menu), which stand on solid frost. */
  solid: Box[];
};

/**
 * The window's shape: a rounded rectangle (`shape`, corner `radius`), and over its top edge a
 * rounded `tab` reaching higher between the header's items (or none), the two blurred together so
 * that the edge fades over `band`, centred on the drawn edge. Fully clear over the graph's clear
 * area and the hero, so the hero is always hidden behind the interior rather than cut off on the
 * frost; at the top, from half a band below the header (or the clear area's top, if higher), so
 * the fade reaches into the header, but a band below the header's items at the sides, so they stand
 * on solid frost. A side that comes within a band of the screen's edge runs off it, corners and fade
 * too, so that side has no frost at all (phones, and narrow screens where the hero is near the
 * edge). The top and bottom never do: the header always stands on the frost, and the bottom edge
 * keeps a strip of it (`bottomFrost`).
 */
export const xrayWindow = ({ width, height, clear, hero, header, solid }: Screen) => {
  const band = bandFor(width);
  const radius = 0.18 * Math.min(width, height);
  // Where the window is fully clear at the top: between the header's items, and at the sides.
  const middle = Math.max(0, Math.min(clear.y, header + band / 2, hero.top));
  const sides = Math.max(middle, ...solid.map((box) => box.bottom + band));
  const area: Box = {
    left: Math.max(0, Math.min(clear.x, hero.left)),
    right: Math.min(width, Math.max(width - clear.x, hero.right)),
    top: sides,
    bottom: Math.min(height - bottomFrost(band), Math.max(height - clear.bottom, hero.bottom)),
  };
  const off = radius + band;
  const shape: Box = {
    left: area.left < band ? -off : area.left - band / 2,
    right: width - area.right < band ? width + off : area.right + band / 2,
    top: area.top - band / 2,
    bottom: area.bottom + band / 2,
  };
  // The tab runs between the items on either half of the header, half a band clear of them.
  const tabRadius = band / 2;
  const leftItems = solid.filter((box) => box.left + box.right < width);
  const rightItems = solid.filter((box) => box.left + box.right >= width);
  const tab: Box = {
    left: leftItems.length ? Math.max(...leftItems.map((box) => box.right)) + band / 2 : shape.left,
    right: rightItems.length ? Math.min(...rightItems.map((box) => box.left)) - band / 2 : shape.right,
    top: middle - band / 2,
    bottom: shape.top + tabRadius,
  };
  const hasTab = sides > middle && tab.right - tab.left >= 2 * tabRadius;
  return { shape, radius, tab: hasTab ? tab : null, tabRadius, band };
};
