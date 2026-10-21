import { useEffect, useRef } from "react";

import { graphs, type GraphId } from "@/lib/graphs";
import { svgToImageUrl } from "@/lib/svg-image";

import { InfraGraph } from "./infra-graph";
import { ViewSwitch } from "./view-switch";

/** The canvas is drawn at this fraction of the screen's size and scaled up: blurred, it needs no more. */
const SCALE = 1 / 4;
/** The frost's blur on screen (px) and how much it boosts colour, baked into the canvas. */
const BLUR = 18;
const SATURATE = 1.3;

/** Paints an element's box (background, border, rounded corners) at its place on screen. */
const paintBox = (context: CanvasRenderingContext2D, element: Element) => {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  context.beginPath();
  context.roundRect(
    box.left * SCALE,
    box.top * SCALE,
    box.width * SCALE,
    box.height * SCALE,
    parseFloat(style.borderTopLeftRadius) * SCALE,
  );
  context.fillStyle = style.backgroundColor;
  context.fill();
  const border = parseFloat(style.borderTopWidth);
  if (border > 0) {
    context.lineWidth = border * SCALE;
    context.strokeStyle = style.borderTopColor;
    context.stroke();
  }
};

/** Paints the view switch (HTML, so it can't go through the SVG image): its boxes and labels. */
const paintSwitch = (context: CanvasRenderingContext2D, element: Element) => {
  paintBox(context, element);
  for (const button of element.querySelectorAll("button")) {
    paintBox(context, button);
    const box = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    context.font = `${style.fontWeight} ${parseFloat(style.fontSize) * SCALE}px ${style.fontFamily}`;
    context.fillStyle = style.color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      button.textContent ?? "",
      (box.left + box.width / 2) * SCALE,
      (box.top + box.height / 2) * SCALE,
    );
  }
};

/**
 * The page's frosted glass: a blurred copy of the interior's graph, lined up with the real one. The
 * blur is baked into a small canvas once (and on resize), not a live CSS filter: Chrome repaints a
 * live blur in pieces, which showed as hard seams. The graph and the view switch are laid out
 * invisibly, to place and draw them.
 */
export const FrostedGraph = ({ graphId }: { graphId: GraphId }) => {
  const graph = graphs[graphId];
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
        const viewSwitch = layout.querySelector("[data-view-switch]");
        if (viewSwitch) paintSwitch(context, viewSwitch);
      };
      image.src = svgToImageUrl(svg, box);
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
  }, [graphId]);

  return (
    <div className="xray-frost fixed inset-0">
      <canvas ref={canvasRef} className="size-full" />
      <div
        ref={layoutRef}
        className="xray-frost-content invisible absolute inset-0 flex h-dvh items-center justify-center"
      >
        <InfraGraph graph={graph} layout={graph.layouts.landscape} decorative className="hidden size-full lg:block" />
        <InfraGraph graph={graph} layout={graph.layouts.portrait} decorative className="size-full lg:hidden" />
        <ViewSwitch value={graphId} />
      </div>
    </div>
  );
};
