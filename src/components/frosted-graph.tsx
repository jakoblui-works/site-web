import { useEffect, useRef } from "react";

import { landscapeLayout, portraitLayout } from "@/lib/infra-graph";

import { InfraGraph } from "./infra-graph";

/** The canvas is drawn at this fraction of the screen's size and scaled up: blurred, it needs no more. */
const SCALE = 1 / 4;
/** The frost's blur on screen (px) and how much it boosts colour, baked into the canvas. */
const BLUR = 18;
const SATURATE = 1.3;

/** What an SVG drawn as an image keeps of each element's styling (it can't see the page's CSS). */
const PAINT = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linejoin",
  "stroke-linecap",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/** A standalone copy of a rendered SVG, its computed styles written inline, as a data URL. */
const toImageUrl = (svg: SVGSVGElement) => {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  from.forEach((element, i) => {
    const style = getComputedStyle(element);
    const target = to[i] as SVGElement;
    target.removeAttribute("class");
    target.setAttribute(
      "style",
      PAINT.map((property) => `${property}:${style.getPropertyValue(property)}`).join(";"),
    );
  });
  const { width, height } = svg.getBoundingClientRect();
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copy.outerHTML)}`;
};

/**
 * The page's frosted glass: a blurred copy of the interior's graph, lined up with the real one. The
 * blur is baked into a small canvas once (and on resize), not a live CSS filter: Chrome repaints a
 * live blur in pieces, which showed as hard seams. The graph itself is laid out invisibly, to place
 * and draw it.
 */
export const FrostedGraph = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;
    let cancelled = false;

    const draw = () => {
      const svg = [...layout.querySelectorAll("svg")].find(
        (candidate) => candidate.getClientRects().length > 0,
      );
      const context = canvas.getContext("2d");
      if (!svg || !context) return;
      const box = svg.getBoundingClientRect();
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        canvas.width = Math.ceil(window.innerWidth * SCALE);
        canvas.height = Math.ceil(window.innerHeight * SCALE);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.filter = `blur(${BLUR * SCALE}px) saturate(${SATURATE})`;
        context.drawImage(
          image,
          box.left * SCALE,
          box.top * SCALE,
          box.width * SCALE,
          box.height * SCALE,
        );
      };
      image.src = toImageUrl(svg);
    };

    draw();
    // Redrawn when the layout changes size (the window, or the clear area it's fitted in).
    const observer = new ResizeObserver(draw);
    observer.observe(layout);
    void document.fonts.ready.then(draw);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div className="xray-frost fixed inset-0">
      <canvas ref={canvasRef} className="size-full" />
      <div
        ref={layoutRef}
        className="xray-frost-content invisible absolute inset-0 flex h-dvh items-center justify-center"
      >
        <InfraGraph layout={landscapeLayout} decorative className="hidden size-full lg:block" />
        <InfraGraph layout={portraitLayout} decorative className="size-full lg:hidden" />
      </div>
    </div>
  );
};
