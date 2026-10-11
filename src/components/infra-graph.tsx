import { useId, type KeyboardEvent } from "react";

import {
  edgeId,
  edgeRoute,
  edges,
  nodes,
  type GraphEdge,
  type GraphLayout,
  type NodeKind,
  type Point,
} from "@/lib/infra-graph";
import { traceGroups } from "@/lib/trace-groups";
import { cn } from "@/lib/utils";

import { InfraLogo } from "./infra-logos";

/** Gap between a trace's arrowhead and the node it points at. */
const EDGE_GAP = 6;
/** How wide a trace's invisible hit area is (viewBox units at the overview's zoom), so it's easy to click. */
const HIT_WIDTH = 14;
/** Node padding, and the logo column on the node's left (one logo, or two stacked). */
const PADDING = 14;
const LOGO_SIZE = { single: 24, stacked: 18 };
const LOGO_GAP = 4;
const TEXT_OFFSET = PADDING + LOGO_SIZE.single + 12;

/** Pulls a route's last point back along its last segment, so the arrowhead stops short of the node. */
const withGap = (route: Point[], gap: number): Point[] => {
  const end = route[route.length - 1];
  const before = route[route.length - 2];
  const length = Math.hypot(end.x - before.x, end.y - before.y);
  if (length <= gap) return route;
  const t = (length - gap) / length;
  return [
    ...route.slice(0, -1),
    { x: before.x + (end.x - before.x) * t, y: before.y + (end.y - before.y) * t },
  ];
};

const toPoints = (route: Point[]) => route.map(({ x, y }) => `${x},${y}`).join(" ");

/** Screw holes in the board's corners, inset from its edge. */
const SCREW_INSET = 18;

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
  /** The selected node: it and its traces stay bright, everything else dims. */
  selected?: string | null;
  /** The selected group of traces: its traces and the parts they connect stay bright. */
  selectedGroup?: string | null;
  /** Makes the nodes and the groups of traces buttons (click, Enter or Space) that select themselves. */
  onSelect?: (id: string) => void;
  /** The node the camera is zooming into: its header fades out as the camera passes it (0..1). */
  zoomedInto?: { id: string; headerOpacity: number } | null;
  className?: string;
};

export const InfraGraph = ({
  layout,
  fit = "contain",
  decorative = false,
  selected = null,
  selectedGroup = null,
  onSelect,
  zoomedInto = null,
  className,
}: InfraGraphProps) => {
  const id = useId();
  const arrowId = `${id}-arrow`;
  const textureId = `${id}-texture`;
  const titleId = `${id}-title`;
  const { node: size, casing, positions } = layout;
  const group = traceGroups.find((candidate) => candidate.id === selectedGroup);
  // What stays bright: everything, or the selected node and its traces, or the selected group.
  const isLit = {
    edge: (edge: GraphEdge) =>
      group
        ? group.edges.includes(edgeId(edge))
        : !selected || edge.from === selected || edge.to === selected,
    node: (id: string) =>
      group
        ? group.edges.some((candidate) => candidate.split("->").includes(id))
        : !selected || selected === id,
  };
  /** Buttons that select themselves with a click, Enter or Space (when `onSelect` is set). */
  const selectable = (id: string, label: string, pressed: boolean) =>
    onSelect && {
      role: "button",
      tabIndex: 0,
      "aria-label": label,
      "aria-pressed": pressed,
      onClick: () => onSelect(id),
      onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      },
    };

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
      {...(decorative
        ? { "aria-hidden": true }
        : // With buttons inside it's a group: an "img" would hide them from assistive tech.
          { role: onSelect ? "group" : "img", "aria-labelledby": titleId })}
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
        {/* Faint board texture: fine 45° lines, like the copper pour on a circuit board. */}
        <pattern
          id={textureId}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="14" className="stroke-violet-200/[0.05] [stroke-width:1]" />
        </pattern>
      </defs>

      <g>
        <rect
          {...casing}
          rx={20}
          className="fill-[oklch(0.21_0.065_292)] stroke-violet-300/35 [stroke-dasharray:6_6] [stroke-width:calc(1px/var(--zoom,1))]"
        />
        <rect {...casing} rx={20} fill={`url(#${textureId})`} />
        {[
          [casing.x + SCREW_INSET, casing.y + SCREW_INSET],
          [casing.x + casing.width - SCREW_INSET, casing.y + SCREW_INSET],
          [casing.x + SCREW_INSET, casing.y + casing.height - SCREW_INSET],
          [casing.x + casing.width - SCREW_INSET, casing.y + casing.height - SCREW_INSET],
        ].map(([cx, cy]) => (
          <g key={`${cx},${cy}`} className="stroke-violet-300/40">
            <circle cx={cx} cy={cy} r={6} className="fill-[oklch(0.13_0.045_292)] [stroke-width:1.5]" />
            <path
              d={`M ${cx - 3} ${cy - 3} L ${cx + 3} ${cy + 3}`}
              className="[stroke-width:1.25]"
            />
          </g>
        ))}
        <text
          x={casing.x + SCREW_INSET + 16}
          y={casing.y + SCREW_INSET + 4}
          className="fill-violet-200/60 font-mono text-[13px]"
        >
          DigitalOcean droplet · fra1
        </text>
      </g>

      {/* The traces, one button per group: clicking any of its traces selects the group. */}
      <g>
        {traceGroups.map((traceGroup) => (
          <g
            key={traceGroup.id}
            data-group={traceGroup.id}
            {...selectable(
              traceGroup.id,
              `${traceGroup.title}: ${traceGroup.path}`,
              selectedGroup === traceGroup.id,
            )}
            className={cn("group/trace outline-none", onSelect && "cursor-pointer")}
          >
            {edges
              .filter((edge) => traceGroup.edges.includes(edgeId(edge)))
              .map((edge) => {
                const route = edgeRoute(layout, edge);
                const [start] = route;
                const lit = isLit.edge(edge);
                return (
                  <g
                    key={edgeId(edge)}
                    data-edge={edgeId(edge)}
                    className={cn(
                      "transition-opacity duration-300",
                      // Around a selected group, the rest recedes further, so its labels read clearly.
                      !lit && (group ? "opacity-10" : "opacity-20"),
                    )}
                  >
                    <polyline
                      points={toPoints(withGap(route, EDGE_GAP))}
                      fill="none"
                      markerEnd={`url(#${arrowId})`}
                      className={cn(
                        "stroke-violet-300/50 transition-[stroke] duration-200 [stroke-width:calc(1.5px/var(--zoom,1))] [stroke-linejoin:round]",
                        edge.dashed && "[stroke-dasharray:5_5]",
                        (selected || group) && lit && "stroke-violet-200",
                        onSelect &&
                          "group-hover/trace:stroke-violet-200 group-focus-visible/trace:stroke-violet-100",
                      )}
                    />
                    {/* Via: the pad where the trace leaves the component. */}
                    <circle
                      cx={start.x}
                      cy={start.y}
                      r={3}
                      className="fill-[oklch(0.13_0.045_292)] stroke-violet-300/70 [stroke-width:calc(1.5px/var(--zoom,1))]"
                    />
                    {/* Invisible and wider than the trace, so it's easy to click. */}
                    {onSelect && (
                      <polyline
                        points={toPoints(route)}
                        fill="none"
                        className="stroke-transparent"
                        style={{ strokeWidth: `calc(${HIT_WIDTH}px / var(--zoom, 1))` }}
                      />
                    )}
                  </g>
                );
              })}
          </g>
        ))}
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
            <g
              key={node.id}
              data-node={node.id}
              {...selectable(node.id, `${node.label}: ${node.detail}`, selected === node.id)}
              className={cn(
                "group outline-none transition-opacity duration-300",
                onSelect && "cursor-pointer",
                !isLit.node(node.id) && (group ? "opacity-15" : "opacity-35"),
              )}
            >
              {/* Focus ring for keyboard users. */}
              <rect
                x={left - 4}
                y={y - size.height / 2 - 4}
                width={size.width + 8}
                height={size.height + 8}
                rx={13}
                className="fill-none stroke-violet-200 opacity-0 [stroke-width:2] group-focus-visible:opacity-100"
              />
              <rect
                x={left}
                y={y - size.height / 2}
                width={size.width}
                height={size.height}
                rx={10}
                className={cn(
                  "transition-[stroke] duration-200 [stroke-width:calc(1.5px/var(--zoom,1))]",
                  nodeStyles[node.kind],
                  onSelect && "group-hover:stroke-violet-200",
                  selected === node.id &&
                    "stroke-violet-200 [stroke-width:calc(2px/var(--zoom,1))]",
                )}
              />
              {/* The header fades out as the camera zooms past it, into the node. */}
              <g
                opacity={
                  zoomedInto?.id === node.id ? zoomedInto.headerOpacity : undefined
                }
              >
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
            </g>
          );
        })}
      </g>
    </svg>
  );
};
