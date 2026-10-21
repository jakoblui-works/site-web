import { useLayoutEffect, type RefObject } from "react";

import { BAND, type Box, xrayWindow } from "@/lib/xray-window";

/** Wide screens show the look-inside panel; phones a button instead (Tailwind's `lg`). */
const WIDE = 1024;
/** The masks are drawn at this fraction of the screen's size and scaled up: blurred, they need no more. */
const SCALE = 1 / 4;

/**
 * The graph's clear area, as margins from the screen's edges, in viewport px: the graph is fitted
 * inside it, and the window is fully clear over it (see `xrayWindow`).
 */
const clearArea = (vw: number, vh: number) =>
  vw >= WIDE ? { x: 0.12 * vw, y: 0.12 * vh } : { x: 0.08 * vw, y: 0.11 * vh };

/** An element's content box (inside its padding), in viewport px. */
const contentBox = (element: Element): Box => {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    left: box.left + parseFloat(style.paddingLeft),
    top: box.top + parseFloat(style.paddingTop),
    right: box.right - parseFloat(style.paddingRight),
    bottom: box.bottom - parseFloat(style.paddingBottom),
  };
};

/**
 * The window's two masks, as images of the screen: the window itself (opaque where the interior
 * shows), and its complement, the rim (opaque where the surface does). Baked once per shape: a
 * blurred rounded rectangle, which a CSS gradient can't draw.
 */
const drawMasks = (vw: number, vh: number, { shape, radius }: ReturnType<typeof xrayWindow>) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vw * SCALE);
  canvas.height = Math.ceil(vh * SCALE);
  const context = canvas.getContext("2d");
  if (!context) return null;
  const drawWindow = () => {
    // A Gaussian edge is about 4 sigma wide.
    context.filter = `blur(${(BAND / 4) * SCALE}px)`;
    context.beginPath();
    context.roundRect(
      shape.left * SCALE,
      shape.top * SCALE,
      (shape.right - shape.left) * SCALE,
      (shape.bottom - shape.top) * SCALE,
      radius * SCALE,
    );
    context.fill();
  };
  drawWindow();
  const inside = canvas.toDataURL();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = "none";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "destination-out";
  drawWindow();
  return { window: inside, rim: canvas.toDataURL() };
};

const apply = (style: CSSStyleDeclaration, values: Record<string, number | string>) => {
  for (const [key, value] of Object.entries(values)) {
    style.setProperty(`--xray-${key}`, typeof value === "number" ? `${value}px` : value);
  }
};

/**
 * Publishes the x-ray's window (see `styles.css`). On the root: the graph's clear area (see
 * `.xray-content`), the screen's size and the window's masks, drawn around the clear area, the hero
 * (`data-xray-cover`) and the header, all inside the surface. While `settled`, the rim's offset
 * into the surface too, for its mask (it may be scrolled; scrolling is locked while open). Follows
 * the screen's size and the hero's.
 */
export const useXrayWindow = (surfaceRef: RefObject<HTMLElement | null>, settled: boolean) => {
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const hero = surface?.querySelector("[data-xray-cover]");
    let drawn = "";
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clear = clearArea(vw, vh);
      const root = document.documentElement.style;
      apply(root, { "clear-x": clear.x, "clear-y": clear.y, width: vw, height: vh });
      if (!surface) return;
      const shape = xrayWindow({
        width: vw,
        height: vh,
        clear,
        // No hero: the clear area alone.
        hero: hero ? contentBox(hero) : { left: vw, top: vh, right: 0, bottom: 0 },
        header: surface.querySelector("header")?.offsetHeight ?? 0,
      });
      // Redrawn only when the shape changes, so the interior isn't masked again for nothing.
      const key = JSON.stringify([vw, vh, shape]);
      if (key !== drawn) {
        const masks = drawMasks(vw, vh, shape);
        if (masks) {
          apply(root, { window: `url("${masks.window}")`, rim: `url("${masks.rim}")` });
          drawn = key;
        }
      }
      if (!settled) return;
      apply(surface.style, { "rim-top": Math.max(0, -surface.getBoundingClientRect().top) });
    };
    place();
    window.addEventListener("resize", place);
    // The hero changes size with the screen, and once the fonts have loaded.
    const observer = new ResizeObserver(place);
    if (hero) observer.observe(hero);
    return () => {
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [surfaceRef, settled]);
};
