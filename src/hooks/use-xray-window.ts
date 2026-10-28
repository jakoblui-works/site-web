import { useLayoutEffect, useRef, type RefObject } from "react";

import { bandFor, bottomFrost, type Box, xrayWindow } from "@/lib/xray-window";

/** Wide screens show the look-inside panel; phones a button instead (Tailwind's `lg`). */
const WIDE = 1024;
/** The masks are drawn at this fraction of the screen's size and scaled up: blurred, they need no more. */
const SCALE = 1 / 4;

/**
 * The graph's clear area, as margins from the screen's edges, in viewport px: the graph is fitted
 * inside it, and the window is fully clear over it (see `xrayWindow`). At the bottom, it keeps
 * clear of the window's strip of frost.
 */
const clearArea = (vw: number, vh: number) => {
  const { x, y } = vw >= WIDE ? { x: 0.12 * vw, y: 0.12 * vh } : { x: 0.08 * vw, y: 0.11 * vh };
  return { x, y, bottom: Math.max(y, bottomFrost(bandFor(vw))) };
};

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
 * shows), and its complement, the rim (opaque where the surface does). Baked once per shape: drawn
 * sharp (the rounded rectangle and its tab together), then blurred, which a CSS gradient can't do.
 */
const drawMasks = (
  vw: number,
  vh: number,
  { shape, radius, tab, tabRadius, band }: ReturnType<typeof xrayWindow>,
) => {
  // The sharp window, a band wider than the screen on each side, so what runs off the screen
  // still blurs as if it went on.
  const margin = band * SCALE;
  const sharp = document.createElement("canvas");
  sharp.width = Math.ceil(vw * SCALE + 2 * margin);
  sharp.height = Math.ceil(vh * SCALE + 2 * margin);
  const outline = sharp.getContext("2d");
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vw * SCALE);
  canvas.height = Math.ceil(vh * SCALE);
  const context = canvas.getContext("2d");
  if (!outline || !context) return null;
  const parts: [Box, number][] = [[shape, radius]];
  if (tab) parts.push([tab, tabRadius]);
  outline.beginPath();
  for (const [box, corner] of parts) {
    outline.roundRect(
      box.left * SCALE + margin,
      box.top * SCALE + margin,
      (box.right - box.left) * SCALE,
      (box.bottom - box.top) * SCALE,
      corner * SCALE,
    );
  }
  outline.fill();
  const drawWindow = () => {
    // A Gaussian edge is about 4 sigma wide.
    context.filter = `blur(${(band / 4) * SCALE}px)`;
    context.drawImage(sharp, -margin, -margin);
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
 * Marks the page once the first masks are decoded (`data-masks-ready` on the root). Opened on an
 * `?xray` link, the x-ray starts settled, so its first frames need the rim; until it's decoded,
 * Firefox drew the surface unmasked (the hero over the graph), so the page stays hidden until then
 * (see `styles.css`). A mask that fails to decode doesn't hold it up.
 */
const markReady = (masks: { window: string; rim: string }) => {
  const root = document.documentElement;
  if (root.hasAttribute("data-masks-ready")) return;
  const decode = (url: string) => {
    const image = new Image();
    image.src = url;
    return image.decode().catch(() => {});
  };
  void Promise.all([decode(masks.window), decode(masks.rim)]).then(() =>
    root.setAttribute("data-masks-ready", ""),
  );
};

/**
 * Publishes the x-ray's window (see `styles.css`). On the root: the graph's clear area (see
 * `.xray-content`), the screen's size and the window's masks, drawn around the clear area, the hero
 * (`data-xray-cover`), the header and its items (`data-xray-solid`), all inside the surface. While `settled`, the rim's offset
 * into the surface too, for its mask (it may be scrolled; scrolling is locked while open). Follows
 * the screen's size and the hero's.
 */
export const useXrayWindow = (surfaceRef: RefObject<HTMLElement | null>, settled: boolean) => {
  // The shape the masks were last drawn for. Kept across the effect's runs: settling re-runs it, and
  // setting the masks again then made Firefox load them again, so on the first opening after a load
  // the surface dropped out while they loaded (a bright flash).
  const drawn = useRef("");
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const hero = surface?.querySelector("[data-xray-cover]");
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clear = clearArea(vw, vh);
      const root = document.documentElement.style;
      apply(root, {
        "clear-x": clear.x,
        "clear-y": clear.y,
        "clear-bottom": clear.bottom,
        width: vw,
        height: vh,
      });
      if (!surface) return;
      const shape = xrayWindow({
        width: vw,
        height: vh,
        clear,
        // No hero: the clear area alone.
        hero: hero ? contentBox(hero) : { left: vw, top: vh, right: 0, bottom: 0 },
        header: surface.querySelector("header")?.offsetHeight ?? 0,
        // What's laid out of them (a label kept only for screen readers isn't).
        solid: [...surface.querySelectorAll("[data-xray-solid]")]
          .map((item) => item.getBoundingClientRect())
          .filter((box) => box.width > 1 && box.height > 1),
      });
      // Redrawn only when the shape changes, so the interior isn't masked again for nothing.
      const key = JSON.stringify([vw, vh, shape]);
      if (key !== drawn.current) {
        const masks = drawMasks(vw, vh, shape);
        if (masks) {
          apply(root, { window: `url("${masks.window}")`, rim: `url("${masks.rim}")` });
          drawn.current = key;
          markReady(masks);
        }
      }
      if (!settled) return;
      apply(surface.style, { "rim-top": Math.max(0, -surface.getBoundingClientRect().top) });
    };
    place();
    window.addEventListener("resize", place);
    // The hero changes size with the screen, and once the fonts have loaded; so do the header's
    // items (the logo's width), which the hero's size doesn't show. Unwatched, the shape went stale
    // until the first settle, whose new masks Firefox then loaded mid-animation (a flash).
    const observer = new ResizeObserver(place);
    if (hero) observer.observe(hero);
    surface?.querySelectorAll("[data-xray-solid]").forEach((item) => observer.observe(item));
    return () => {
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [surfaceRef, settled]);
};
