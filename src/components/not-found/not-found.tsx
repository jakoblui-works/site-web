import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import { notFoundGraph } from "@/lib/graphs/not-found";
import type { GraphLayout } from "@/lib/infra-graph";
import { cn } from "@/lib/utils";

import { TailArrow } from "@/components/hero/hero";
import { InfraGraph } from "@/components/xray/infra-graph/infra-graph";

/** How far the dead end runs out of Traefik before it stops, and the size of its cross. */
const DEAD_END = 115;
const CROSS = 7;

/**
 * Traefik's trace with nowhere to go: it leaves the node like the others (via, trace), and stops at
 * a cross. Out of the side on wide screens, downwards on phones.
 */
const DeadEnd = ({ layout, down }: { layout: GraphLayout; down: boolean }) => {
  const { x, y } = layout.positions.traefik;
  const start = down
    ? { x, y: y + layout.node.height / 2 }
    : { x: x + layout.node.width / 2, y };
  const end = down ? { x, y: start.y + DEAD_END } : { x: start.x + DEAD_END, y };
  const cross = down ? { x, y: end.y + 20 } : { x: end.x + 20, y };
  return (
    <g>
      <g className="text-violet-300 opacity-50">
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          className="stroke-current [stroke-width:1.5]"
        />
        <circle
          cx={start.x}
          cy={start.y}
          r={3}
          className="fill-[oklch(0.13_0.045_292)] stroke-current [stroke-width:1.5]"
        />
      </g>
      <path
        d={`M ${cross.x - CROSS} ${cross.y - CROSS} L ${cross.x + CROSS} ${cross.y + CROSS} M ${cross.x + CROSS} ${cross.y - CROSS} L ${cross.x - CROSS} ${cross.y + CROSS}`}
        className="stroke-red-400 [stroke-width:2] [stroke-linecap:round]"
      />
      {/* The status, with what it means under it: on phones left of the cross (Traefik is on the
          casing's right), below it otherwise. */}
      <text
        x={down ? cross.x - 20 : cross.x}
        y={down ? cross.y - 3 : cross.y + 34}
        textAnchor={down ? "end" : "middle"}
        className="fill-red-400 font-mono text-[16px] font-semibold"
      >
        404
      </text>
      <text
        x={down ? cross.x - 20 : cross.x}
        y={down ? cross.y + 14 : cross.y + 51}
        textAnchor={down ? "end" : "middle"}
        className="fill-red-300/80 font-mono text-[12px]"
      >
        no route
      </text>
    </g>
  );
};

/** The 404 page's content (the page adds the header): what was asked for, and the way home. */
export const NotFound = ({ path }: { path: string }) => {
  const { landscape, portrait } = notFoundGraph.layouts;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-24 lg:py-16">
      <h1 className="font-heading text-[clamp(2.25rem,10.5vw,3.75rem)] leading-none font-bold tracking-[-0.045em] text-neutral-200 lg:text-[clamp(4rem,6vw,5.5rem)]">
        No route here
      </h1>
      <p className="mt-6 font-mono text-base break-all text-neutral-400 sm:text-lg">
        GET {path}
      </p>
      {/* The picture through a window like the open x-ray's (see `.not-found-window`): the
          interior's cavity and board, under its shade (`.xray-content::after`) and the rim. */}
      <div className="not-found-window relative mt-2 overflow-hidden bg-[oklch(0.13_0.045_292)]">
        <InfraGraph
          graph={notFoundGraph}
          layout={landscape}
          decorative
          grid
          className="hidden max-w-2xl sm:block"
        >
          <DeadEnd layout={landscape} down={false} />
        </InfraGraph>
        <InfraGraph
          graph={notFoundGraph}
          layout={portrait}
          decorative
          grid
          className="mx-auto max-w-sm sm:hidden"
        >
          <DeadEnd layout={portrait} down />
        </InfraGraph>
        <div aria-hidden className="absolute inset-0 bg-black/10" />
        <div aria-hidden className="not-found-rim absolute inset-0" />
      </div>
      <Link
        to="/"
        className={cn(
          buttonVariants({ size: "lg" }),
          "mt-2 h-14 gap-2.5 rounded-[10px] border-0 bg-clip-border px-7 text-lg font-bold hover:bg-primary-300",
        )}
      >
        Back to home
        <TailArrow className="size-4.5 w-5.25" />
      </Link>
    </section>
  );
};
