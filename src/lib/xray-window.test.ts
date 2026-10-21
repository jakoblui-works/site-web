import { describe, expect, it } from "vitest";

import { bandFor, bottomFrost, type Box, xrayWindow } from "./xray-window";

const HEADER = 64;

/** The hero's content: `max-w-6xl` (72rem, 1rem padding a side) centred, its bottom as measured. */
const hero = (width: number, top: number, bottom: number): Box => {
  const left = Math.max(0, (width - 1152) / 2) + 16;
  return { left, top, right: width - left, bottom };
};

/** The header's items, roughly as laid out: the logo on the left, the work menu's icon and label (icon only on phones) on the right. */
const items = (width: number): Box[] => {
  const left = Math.max(0, (width - 1152) / 2) + 16;
  const work = width < 640 ? 22 : 70;
  return [
    { left, top: 24, right: left + 180, bottom: 52 },
    { left: width - left - work, top: 28, right: width - left, bottom: 48 },
  ];
};

/** The graph's clear area, its bottom kept clear of the frost as `useXrayWindow` does. */
const clear = (width: number, x: number, y: number) => ({
  x,
  y,
  bottom: Math.max(y, bottomFrost(bandFor(width))),
});

/** A laptop, a small and a big monitor, an ultrawide, a tablet and a phone (the clear area as `useXrayWindow` sets it). */
const screens = {
  laptop: { width: 1280, height: 800, clear: clear(1280, 154, 96), hero: hero(1280, 200, 656) },
  small: { width: 1440, height: 900, clear: clear(1440, 173, 108), hero: hero(1440, 230, 706) },
  monitor: { width: 1920, height: 1080, clear: clear(1920, 230, 130), hero: hero(1920, 310, 828) },
  ultrawide: { width: 3440, height: 1440, clear: clear(3440, 413, 173), hero: hero(3440, 490, 970) },
  tablet: { width: 820, height: 1180, clear: clear(820, 66, 130), hero: hero(820, 260, 803) },
  phone: { width: 390, height: 844, clear: clear(390, 31, 93), hero: hero(390, 112, 636) },
};

const shapeOn = (screen: (typeof screens)[keyof typeof screens]) =>
  xrayWindow({ ...screen, header: HEADER, solid: items(screen.width) });

describe.each(Object.entries(screens))("the x-ray's window on a %s", (_, screen) => {
  const { shape, radius, tab, band } = shapeOn(screen);
  const { width, height } = screen;
  const solid = items(width);
  // Where the window is fully clear: half a band inside the drawn edge (at the top, the sides').
  const clear: Box = {
    left: shape.left + band / 2,
    top: shape.top + band / 2,
    right: shape.right - band / 2,
    bottom: shape.bottom - band / 2,
  };

  it("is fully clear over the graph's clear area, below the header's items", () => {
    const itemsBottom = Math.max(...solid.map((box) => box.bottom));
    expect(clear.left).toBeLessThanOrEqual(screen.clear.x);
    expect(clear.right).toBeGreaterThanOrEqual(width - screen.clear.x);
    expect(clear.top).toBeLessThanOrEqual(Math.max(screen.clear.y, itemsBottom + band));
    expect(clear.bottom).toBeGreaterThanOrEqual(height - screen.clear.bottom);
  });

  it("is fully clear over the hero (on screen)", () => {
    expect(clear.left).toBeLessThanOrEqual(screen.hero.left);
    expect(clear.right).toBeGreaterThanOrEqual(screen.hero.right);
    expect(clear.top).toBeLessThanOrEqual(screen.hero.top);
    expect(clear.bottom).toBeGreaterThanOrEqual(Math.min(height, screen.hero.bottom));
  });

  it("keeps the header's items on solid frost", () => {
    for (const item of solid) {
      // Below them, the fade only starts half a band down.
      expect(shape.top - band / 2).toBeGreaterThanOrEqual(item.bottom);
      // Beside the tab, half a band away.
      if (tab) {
        const away = Math.max(tab.left - item.right, item.left - tab.right, tab.top - item.bottom);
        expect(away).toBeGreaterThanOrEqual(band / 2);
      }
    }
  });

  it("fades from inside the header between its items, which stays on the frost", () => {
    const top = tab?.top ?? shape.top;
    expect(top - band / 2).toBeLessThan(HEADER);
    // At the screen's top edge, more frost than glass.
    expect(top).toBeGreaterThan(0);
  });

  it("keeps a strip of solid frost at the bottom", () => {
    // The fade ends half a band above the screen's bottom edge, or higher.
    expect(shape.bottom + band / 2).toBeLessThanOrEqual(height - band / 2);
  });

  it("runs off a side it comes within a band of, corners and fade too, and leaves frost at the others", () => {
    const margins = {
      left: Math.min(screen.clear.x, screen.hero.left),
      right: width - Math.max(width - screen.clear.x, screen.hero.right),
    };
    const beyond = { left: -shape.left, right: shape.right - width };
    for (const side of ["left", "right"] as const) {
      if (margins[side] < band) {
        expect(beyond[side]).toBeGreaterThanOrEqual(radius + band / 2);
      } else {
        // The fade starts on screen, so the edge itself is frost.
        expect(beyond[side]).toBeLessThanOrEqual(-band / 2);
      }
    }
  });
});

it("reaches higher between the header's items on wide screens", () => {
  const { shape, tab } = shapeOn(screens.monitor);
  expect(tab).not.toBeNull();
  expect(tab!.top).toBeLessThan(shape.top);
});

it("runs off the sides on a phone, so the hero is never on the frost there", () => {
  const { shape } = shapeOn(screens.phone);
  expect(shape.left).toBeLessThan(0);
  expect(shape.right).toBeGreaterThan(screens.phone.width);
});
