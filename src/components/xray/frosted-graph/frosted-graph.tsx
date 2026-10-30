import { useEffect, useRef } from "react";

import { graphs, type GraphId } from "@/lib/graphs";
import type { GraphLayout } from "@/lib/infra-graph";
import { averageBackground, rasterize, svgToImageUrl } from "@/lib/svg-image";
import { fitScale } from "@/lib/zoom";

import { InfraGraph } from "@/components/xray/infra-graph/infra-graph";
import { ViewSwitch } from "@/components/xray/view-switch/view-switch";

/** The canvas is drawn at this fraction of the screen's size and scaled up: blurred, it needs no more. */
const SCALE = 1 / 4;
/** The frost's blur on screen (px) and how much it boosts colour, baked into the canvas. */
const BLUR = 18;
const SATURATE = 1.3;

/** Wide screens show the look-inside panel (Tailwind's `lg`). */
const WIDE = 1024;
/**
 * How the interior looks behind the look-inside panel: dimmed and frosted, and brighter and sharp
 * while it's hovered or focused. Over it, the interior's own shade (`.xray-content::after`).
 */
const PANEL_LOOKS = [
  { variable: "--xray-panel-view", opacity: 0.55, blur: 4 },
  { variable: "--xray-panel-view-clear", opacity: 0.9, blur: 0 },
];
const INTERIOR_SHADE = "rgb(0 0 0 / 0.1)";
/**
 * How long the panel's pictures wait (ms) after the last change before they're drawn: a moment while
 * the panel shows, and while the x-ray is open (the panel hidden) long enough not to hold up the
 * view switch's cross-fade.
 */
const PANEL_DELAY = { closed: 50, open: 700 };

/**
 * The look-inside panel's pictures of the interior, one per look: the whole screen (the panel shows
 * its part, fixed to the screen like the interior), drawn from the graph laid out like the interior's
 * (`svg`). Returns object URLs to set as the looks' variables.
 */
const drawPanelViews = async (svg: SVGSVGElement, layout: GraphLayout) => {
  const interior = document.querySelector(".xray-interior");
  if (!interior) return null;
  // The whole screen, in the graph's viewBox units (fitted `xMidYMid meet` in its box).
  const box = svg.getBoundingClientRect();
  const fit = fitScale(layout, box);
  const viewBox = {
    x: (-box.left - (box.width - layout.width * fit) / 2) / fit,
    y: (-box.top - (box.height - layout.height * fit) / 2) / fit,
    width: window.innerWidth / fit,
    height: window.innerHeight / fit,
  };
  const size = {
    width: Math.ceil(window.innerWidth * devicePixelRatio),
    height: Math.ceil(window.innerHeight * devicePixelRatio),
  };
  const [graphImage, background] = await Promise.all([
    rasterize(svg, size, { viewBox }),
    averageBackground(interior),
  ]);
  return Promise.all(
    PANEL_LOOKS.map(async ({ variable, opacity, blur }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = background;
        context.fillRect(0, 0, size.width, size.height);
        context.globalAlpha = opacity;
        context.filter = blur ? `blur(${blur * devicePixelRatio}px)` : "none";
        context.drawImage(graphImage, 0, 0);
        context.globalAlpha = 1;
        context.filter = "none";
        context.fillStyle = INTERIOR_SHADE;
        context.fillRect(0, 0, size.width, size.height);
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
      return { variable, url: blob ? URL.createObjectURL(blob) : null };
    }),
  );
};

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
 * invisibly, to place and draw them. On wide screens it also draws the look-inside panel's pictures
 * of the interior (see `drawPanelViews`).
 */
export const FrostedGraph = ({ graphId, open }: { graphId: GraphId; open: boolean }) => {
  const graph = graphs[graphId];
  // Whether the x-ray is open, for the drawing scheduled below.
  const isOpen = useRef(open);
  useEffect(() => {
    isOpen.current = open;
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  // The panel's pictures as shown (object URLs), let go of once replaced.
  const panelViews = useRef<string[]>([]);
  useEffect(
    () => () => {
      panelViews.current.forEach((url) => URL.revokeObjectURL(url));
      for (const { variable } of PANEL_LOOKS) document.documentElement.style.removeProperty(variable);
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;
    let cancelled = false;

    // The panel's pictures are the bigger job: drawn once things have settled, so several redraws in
    // a row make one.
    let panelTimer: ReturnType<typeof setTimeout> | undefined;
    const drawPanel = () => {
      clearTimeout(panelTimer);
      if (window.innerWidth < WIDE) return;
      panelTimer = setTimeout(
        () => {
          const svg = [...layout.querySelectorAll("svg")].find(
            (candidate) => candidate.getClientRects().length > 0,
          );
          if (!svg) return;
          void drawPanelViews(svg, graph.layouts.landscape).then((views) => {
            const urls = views?.flatMap(({ url }) => (url ? [url] : [])) ?? [];
            if (cancelled || !views) {
              urls.forEach((url) => URL.revokeObjectURL(url));
              return;
            }
            const root = document.documentElement.style;
            for (const { variable, url } of views) {
              if (url) root.setProperty(variable, `url("${url}")`);
            }
            panelViews.current.forEach((url) => URL.revokeObjectURL(url));
            panelViews.current = urls;
          });
        },
        isOpen.current ? PANEL_DELAY.open : PANEL_DELAY.closed,
      );
    };

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
        drawPanel();
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
      clearTimeout(panelTimer);
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
        <InfraGraph graph={graph} layout={graph.layouts.landscape} decorative grid className="hidden size-full lg:block" />
        <InfraGraph graph={graph} layout={graph.layouts.portrait} decorative grid className="size-full lg:hidden" />
        <ViewSwitch value={graphId} />
      </div>
    </div>
  );
};
