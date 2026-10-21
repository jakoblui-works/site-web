import { describe, expect, it } from "vitest";

import { BAND, type Box, xrayWindow } from "./xray-window";

const HEADER = 64;

/** The hero's content: `max-w-6xl` (72rem, 1rem padding a side) centred, its height roughly as laid out. */
const hero = (width: number, top: number, bottom: number): Box => {
  const left = Math.max(0, (width - 1152) / 2) + 16;
  return { left, top, right: width - left, bottom };
};

/** A laptop, a small and a big monitor, an ultrawide, a tablet and a phone (the clear area as `useXrayWindow` sets it). */
const screens = {
  laptop: { width: 1280, height: 800, clear: { x: 154, y: 96 }, hero: hero(1280, 200, 640) },
  small: { width: 1440, height: 900, clear: { x: 173, y: 108 }, hero: hero(1440, 230, 700) },
  monitor: { width: 1920, height: 1080, clear: { x: 230, y: 130 }, hero: hero(1920, 310, 790) },
  ultrawide: { width: 3440, height: 1440, clear: { x: 413, y: 173 }, hero: hero(3440, 490, 970) },
  tablet: { width: 820, height: 1180, clear: { x: 66, y: 130 }, hero: hero(820, 260, 900) },
  phone: { width: 390, height: 844, clear: { x: 31, y: 93 }, hero: hero(390, 112, 900) },
};

/** Where the window is fully clear: half a band inside its shape's edge. */
const clearPart = ({ shape }: ReturnType<typeof xrayWindow>): Box => ({
  left: shape.left + BAND / 2,
  top: shape.top + BAND / 2,
  right: shape.right - BAND / 2,
  bottom: shape.bottom - BAND / 2,
});

describe.each(Object.entries(screens))("the x-ray's window on a %s", (_, screen) => {
  const window = xrayWindow({ ...screen, header: HEADER });
  const clear = clearPart(window);
  const { width, height } = screen;

  it("is fully clear over the graph's clear area", () => {
    expect(clear.left).toBeLessThanOrEqual(screen.clear.x);
    expect(clear.right).toBeGreaterThanOrEqual(width - screen.clear.x);
    expect(clear.top).toBeLessThanOrEqual(screen.clear.y);
    expect(clear.bottom).toBeGreaterThanOrEqual(height - screen.clear.y);
  });

  it("is fully clear over the hero (on screen)", () => {
    expect(clear.left).toBeLessThanOrEqual(screen.hero.left);
    expect(clear.right).toBeGreaterThanOrEqual(screen.hero.right);
    expect(clear.top).toBeLessThanOrEqual(screen.hero.top);
    expect(clear.bottom).toBeGreaterThanOrEqual(Math.min(height, screen.hero.bottom));
  });

  it("fades from inside the header, which stays on the frost", () => {
    expect(window.shape.top - BAND / 2).toBeLessThan(HEADER);
    // At the screen's top edge, more frost than glass.
    expect(window.shape.top).toBeGreaterThan(0);
  });

  it("runs off a side it comes within a band of, corners and fade too, and leaves frost at the others", () => {
    const margins = {
      left: Math.min(screen.clear.x, screen.hero.left),
      right: width - Math.max(width - screen.clear.x, screen.hero.right),
      bottom: height - Math.max(height - screen.clear.y, Math.min(height, screen.hero.bottom)),
    };
    const beyond = {
      left: -window.shape.left,
      right: window.shape.right - width,
      bottom: window.shape.bottom - height,
    };
    for (const side of ["left", "right", "bottom"] as const) {
      if (margins[side] < BAND) {
        expect(beyond[side]).toBeGreaterThanOrEqual(window.radius + BAND / 2);
      } else {
        // The fade starts on screen, so the edge itself is frost.
        expect(beyond[side]).toBeLessThanOrEqual(-BAND / 2);
      }
    }
  });
});

it("runs off the sides on a phone, so the hero is never on the frost there", () => {
  const { shape } = xrayWindow({ ...screens.phone, header: HEADER });
  expect(shape.left).toBeLessThan(0);
  expect(shape.right).toBeGreaterThan(screens.phone.width);
});
