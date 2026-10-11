import { useId } from "react";

import {
  edgeId,
  edges,
  nodes,
  type GraphLayout,
  type NodeKind,
  type Point,
} from "@/lib/infra-graph";
import { cn } from "@/lib/utils";

import { InfraLogo } from "./infra-logos";

/** Gap between an edge's arrowhead and the node it points at. */
const EDGE_GAP = 6;
/** Node padding, and the logo column on the node's left (one logo, or two stacked). */
const PADDING = 14;
const LOGO_SIZE = { single: 24, stacked: 18 };
const LOGO_GAP = 4;
const TEXT_OFFSET = PADDING + LOGO_SIZE.single + 12;

/** Where the line from `centre` towards `target` leaves a box of the given size centred on `centre`. */
const boxExit = (
  centre: Point,
  target: Point,
  size: { width: number; height: number },
  gap: number,
): Point => {
  const dx = target.x - centre.x;
  const dy = target.y - centre.y;
  const length = Math.hypot(dx, dy);
  const scale = Math.min(
    dx === 0 ? Infinity : size.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : size.height / 2 / Math.abs(dy),
  );
  const extra = length === 0 ? 0 : gap / length;
  return {
    x: centre.x + dx * (scale + extra),
    y: centre.y + dy * (scale + extra),
  };
};

// The interior is themed in the brand's violet: a deep purple cavity (set by the x-ray layer),
// a lighter board for the droplet, and violet-tinted nodes and traces.
const nodeStyles: Record<NodeKind, string> = {
  client: "fill-[oklch(0.3_0.08_292)] stroke-violet-200/60",
  external: "fill-[oklch(0.22_0.06_292)] stroke-violet-300/40 [stroke-dasharray:4_4]",
  edge: "fill-[oklch(0.27_0.09_292)] stroke-violet-300",
  frontend: "fill-[oklch(0.26_0.07_292)] stroke-violet-300/45",
  service: "fill-[oklch(0.26_0.07_292)] stroke-violet-300/55",
  store: "fill-[oklch(0.21_0.06_292)] stroke-violet-300/45",
};

type InfraGraphProps = {
  layout: GraphLayout;
  /** `contain` shows the whole graph; `cover` fills the box and crops (for glimpses). */
  fit?: "contain" | "cover";
  /** Purely visual (e.g. inside a button that has its own label): hidden from assistive tech. */
  decorative?: boolean;
  className?: string;
};

export const InfraGraph = ({
  layout,
  fit = "contain",
  decorative = false,
  className,
}: InfraGraphProps) => {
  const id = useId();
  const arrowId = `${id}-arrow`;
  const titleId = `${id}-title`;
  const { node: size, casing, positions } = layout;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-labelledby": titleId })}
      className={cn("h-auto w-full", className)}
    >
      {!decorative && (
        <title id={titleId}>
          Infrastructure: a browser reaches Traefik on a DigitalOcean droplet,
          which routes to the frontends and the api; the api queues CV jobs on
          Redis for the cv-worker, and both use Postgres and Garage.
        </title>
      )}
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" className="fill-violet-300/80" />
        </marker>
      </defs>

      <g>
        <rect
          {...casing}
          rx={20}
          className="fill-[oklch(0.21_0.065_292)] stroke-violet-300/35 [stroke-dasharray:6_6]"
        />
        <text
          x={casing.x + 20}
          y={casing.y + 28}
          className="fill-violet-200/60 font-mono text-[13px]"
        >
          DigitalOcean droplet · fra1
        </text>
      </g>

      <g>
        {edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          const start = boxExit(from, to, size, 0);
          const end = boxExit(to, from, size, EDGE_GAP);
          return (
            <line
              key={edgeId(edge)}
              data-edge={edgeId(edge)}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              markerEnd={`url(#${arrowId})`}
              className={cn(
                "stroke-violet-300/50 [stroke-width:1.5]",
                edge.dashed && "[stroke-dasharray:5_5]",
              )}
            />
          );
        })}
      </g>

      <g>
        {nodes.map((node) => {
          const { x, y } = positions[node.id];
          const left = x - size.width / 2;
          const logoSize =
            node.logos.length > 1 ? LOGO_SIZE.stacked : LOGO_SIZE.single;
          const logosHeight =
            node.logos.length * logoSize + (node.logos.length - 1) * LOGO_GAP;
          const logoX = left + PADDING + (LOGO_SIZE.single - logoSize) / 2;
          return (
            <g key={node.id} data-node={node.id}>
              <rect
                x={left}
                y={y - size.height / 2}
                width={size.width}
                height={size.height}
                rx={10}
                className={cn("[stroke-width:1.5]", nodeStyles[node.kind])}
              />
              {node.logos.map((logo, i) => (
                <InfraLogo
                  key={logo}
                  id={logo}
                  x={logoX}
                  y={y - logosHeight / 2 + i * (logoSize + LOGO_GAP)}
                  size={logoSize}
                  className="text-violet-100"
                />
              ))}
              <text
                x={left + TEXT_OFFSET}
                y={y - 4}
                className="fill-white font-heading text-[17px] font-semibold"
              >
                {node.label}
              </text>
              <text
                x={left + TEXT_OFFSET}
                y={y + 17}
                className="fill-violet-200/75 font-mono text-[12px]"
              >
                {node.detail}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
