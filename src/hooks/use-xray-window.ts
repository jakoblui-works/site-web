import { useLayoutEffect, type RefObject } from "react";

/** Wide screens show the look-inside panel; phones a button instead (Tailwind's `lg`). */
const WIDE = 1024;

/**
 * The window's shape, in viewport px: the clear area (where the window is fully open, measured from
 * the screen's edges; the graph is fitted inside it) and how far the fade reaches outwards from it,
 * across and down (a smoothstep curve, see `styles.css`). Where the fade is longer than the clear
 * margin, the window starts past the screen edge, so the edge is already partly open. Phones have
 * little room across, so their side fade is shorter.
 */
const windowShape = (vw: number, vh: number) =>
  vw >= WIDE
    ? {
        clearX: 0.12 * vw,
        clearY: 0.12 * vh,
        fadeX: 0.3 * Math.min(vw, vh),
        fadeY: 0.2 * Math.min(vw, vh),
      }
    : { clearX: 0.08 * vw, clearY: 0.11 * vh, fadeX: 0.25 * vw, fadeY: 0.3 * vh };

const apply = (style: CSSStyleDeclaration, values: Record<string, number>) => {
  for (const [key, value] of Object.entries(values)) {
    style.setProperty(`--xray-${key}`, `${value}px`);
  }
};

/**
 * Publishes the x-ray's window (see `styles.css`). On the root: px insets from the screen's edges
 * and the fade across and down, for the interior's mask; and the clear area, which the graph is
 * fitted inside (see `.xray-content`). While `settled`, the same insets relative to the surface too,
 * for its mask (it may be scrolled; scrolling is locked while open). Follows the screen's size.
 */
export const useXrayWindow = (surfaceRef: RefObject<HTMLElement | null>, settled: boolean) => {
  useLayoutEffect(() => {
    const place = () => {
      const vh = window.innerHeight;
      const shape = windowShape(window.innerWidth, vh);
      const x = shape.clearX - shape.fadeX;
      const y = shape.clearY - shape.fadeY;
      const fades = { "fade-x": shape.fadeX, "fade-y": shape.fadeY };
      apply(document.documentElement.style, {
        "clear-x": shape.clearX,
        "clear-y": shape.clearY,
        top: y,
        bottom: y,
        left: x,
        right: x,
        ...fades,
      });
      const surface = surfaceRef.current;
      if (!settled || !surface) return;
      const box = surface.getBoundingClientRect();
      apply(surface.style, {
        top: Math.max(0, -box.top) + y,
        bottom: Math.max(0, box.bottom - vh) + y,
        left: x,
        right: x,
        ...fades,
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [surfaceRef, settled]);
};
