import { useLayoutEffect, useRef, type RefObject } from "react";

type Side = "top" | "right" | "bottom" | "left";
type Hole = Record<Side | "fade", number>;
type Window = Record<Side | "fade-x" | "fade-y", number>;

/** Matches the strength transition in `styles.css`. */
const ANIMATION_MS = 800;
/** The hole under the panel only softens at its very edge (the glass covers it). */
const HOLE_FADE = 12;
/** Wide screens show the look-inside panel; phones a button instead (Tailwind's `lg`). */
const WIDE = 1024;

/**
 * The window's shape, in viewport px: the clear area (where the surface is fully gone, measured from
 * the screen's edges; the graph is fitted inside it) and how far the opacity gradient reaches
 * outwards from it, across and down (a smoothstep curve, see `styles.css`). Where the fade is longer
 * than the clear margin, the window starts past the screen edge, so the edge is already partly
 * see-through. Phones have little room across, so their side fade is shorter.
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

const isShown = (element: HTMLElement) => element.getClientRects().length > 0;

/**
 * Lays out the x-ray's masks on the surface (see `styles.css`): the hole under the look-inside panel
 * (wide screens only) and the window over the visible screen. Opening only turns the window's
 * strength up (via `data-open`); the content is masked from opening until the strength is back to 0.
 * Insets are px relative to the surface.
 */
export const useXrayWindow = (
  surfaceRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
) => {
  const firstRun = useRef(true);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const panel = panelRef.current;
    if (!surface || !panel) return;

    const apply = (name: "xray" | "hole", insets: Hole | Window) => {
      for (const [key, value] of Object.entries(insets)) {
        surface.style.setProperty(`--${name}-${key}`, `${value}px`);
      }
    };

    const hole = (): Hole => {
      const s = surface.getBoundingClientRect();
      if (!isShown(panel)) {
        // No hole: insets that cover the whole surface.
        return { top: s.height, right: s.width, bottom: s.height, left: s.width, fade: 0 };
      }
      const p = panel.getBoundingClientRect();
      return {
        top: p.top - s.top,
        right: s.right - p.right,
        bottom: s.bottom - p.bottom,
        left: p.left - s.left,
        fade: HOLE_FADE,
      };
    };

    // Over the visible part of the surface (scrolling is locked while open). Also publishes the
    // clear area for the interior, which fits the graph inside it (see `.xray-content`).
    const window_ = (): Window => {
      const s = surface.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const shape = windowShape(vw, vh);
      const root = document.documentElement.style;
      root.setProperty("--xray-clear-x", `${shape.clearX}px`);
      root.setProperty("--xray-clear-y", `${shape.clearY}px`);
      const x = shape.clearX - shape.fadeX;
      const y = shape.clearY - shape.fadeY;
      return {
        top: Math.max(0, -s.top) + y,
        right: x,
        bottom: Math.max(0, s.bottom - vh) + y,
        left: x,
        "fade-x": shape.fadeX,
        "fade-y": shape.fadeY,
      };
    };

    const place = () => {
      apply("hole", hole());
      // The window is measured when opening starts and then stays put until it's unused again.
      if (open || !surface.dataset.masked) apply("xray", window_());
    };
    place();

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      surface.dataset.masked = "";
    } else if (!firstRun.current) {
      // Closing: keep the content masked until the strength is back to 0.
      timer = setTimeout(() => delete surface.dataset.masked, ANIMATION_MS);
    }
    firstRun.current = false;

    const observer = new ResizeObserver(place);
    observer.observe(surface);
    observer.observe(panel);
    window.addEventListener("resize", place);
    void document.fonts.ready.then(place);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [surfaceRef, panelRef, open]);
};
