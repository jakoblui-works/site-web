import {
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  edgeId,
  edgeRoute,
  GRID,
  type Graph,
  type GraphEdge,
  type GraphLayout,
  type NodeKind,
  type Point,
} from "@/lib/infra-graph";
import { NEAR_TRACE, nearestTraceGroup, nodesOf } from "@/lib/trace-groups";
import { cn } from "@/lib/utils";

import { InfraLogo } from "@/components/xray/infra-logos/infra-logos";

/** Gap between a trace's arrowhead and the node it points at. */
const EDGE_GAP = 6;
/** How wide a trace's invisible hit area is (viewBox units), so it's easy to click. */
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

/** The arrowhead at a trace's end: how far back its base is from the tip, and its half-width. */
const ARROW_LENGTH = 9.5;
const ARROW_HALF_WIDTH = 4.2;

/** An arrowhead with its tip at the route's end, pointing along its last segment. */
const arrowhead = (route: Point[]) => {
  const tip = route[route.length - 1];
  const before = route[route.length - 2];
  const length = Math.hypot(tip.x - before.x, tip.y - before.y);
  const dx = (tip.x - before.x) / length;
  const dy = (tip.y - before.y) / length;
  const base = { x: tip.x - dx * ARROW_LENGTH, y: tip.y - dy * ARROW_LENGTH };
  return toPoints([
    tip,
    { x: base.x - dy * ARROW_HALF_WIDTH, y: base.y + dx * ARROW_HALF_WIDTH },
    { x: base.x + dy * ARROW_HALF_WIDTH, y: base.y - dx * ARROW_HALF_WIDTH },
  ]);
};

/** How far the dot grid reaches past the layout on every side (a multiple of `GRID`), so it fills the screen. */
const GRID_REACH = 4000;

/** Screw holes in the board's corners, inset from its edge. */
const SCREW_INSET = 18;

// The interior is themed in the brand's violet: a deep purple cavity (set by the x-ray layer),
// a lighter board for the casing, and violet-tinted nodes and traces.
const nodeStyles: Record<NodeKind, string> = {
  client: "fill-[oklch(0.3_0.08_292)] stroke-violet-200/60",
  external: "fill-[oklch(0.22_0.06_292)] stroke-violet-300/40 [stroke-dasharray:4_4]",
  edge: "fill-[oklch(0.27_0.09_292)] stroke-violet-300",
  frontend: "fill-[oklch(0.26_0.07_292)] stroke-violet-300/45",
  service: "fill-[oklch(0.26_0.07_292)] stroke-violet-300/55",
  store: "fill-[oklch(0.21_0.06_292)] stroke-violet-300/45",
};

type InfraGraphProps = {
  graph: Graph;
  /** One of the graph's layouts. */
  layout: GraphLayout;
  /** `contain` shows the whole graph; `cover` fills the box and crops (for glimpses). */
  fit?: "contain" | "cover";
  /** Purely visual (e.g. inside a button that has its own label): hidden from assistive tech. */
  decorative?: boolean;
  /** Draws the dot grid behind it, out past its edges, so the grid moves and scales with the graph. */
  grid?: boolean;
  /** The selected node: it and its traces stay bright, everything else dims. */
  selected?: string | null;
  /** The selected group of traces: its traces and the parts they connect stay bright. */
  selectedGroup?: string | null;
  /**
   * How far a selection has dimmed everything else (0..1, default 1). At 0 only the selection itself
   * shows: how the x-ray's zoom snapshots start. The x-ray drives it with the zoom, so the live graph
   * dims in step with its snapshots.
   */
  dim?: number;
  /**
   * The selection the dimming starts from (at `dim` 0), fading to this one's (at 1): zooming from a
   * group of traces into one of its nodes. By default, none: everything bright.
   */
  from?: Selection | null;
  /** Makes the nodes and the groups of traces buttons (click, Enter or Space) that select themselves. */
  onSelect?: (id: string) => void;
  /** Which nodes and groups `onSelect` makes buttons of (default: all). */
  targets?: string[];
  /** The node the camera is zooming into: its header fades out as the camera passes it (0..1). */
  zoomedInto?: { id: string; headerOpacity: number } | null;
  /** Drawn over the graph, in the layout's units. */
  children?: ReactNode;
  className?: string;
};

/** What's selected: a node, or a group of traces. */
type Selection = { selected?: string | null; selectedGroup?: string | null };

export const InfraGraph = ({
  graph,
  layout,
  fit = "contain",
  decorative = false,
  grid = false,
  selected = null,
  selectedGroup = null,
  dim = 1,
  from = null,
  onSelect,
  targets,
  zoomedInto = null,
  children,
  className,
}: InfraGraphProps) => {
  const id = useId();
  const textureId = `${id}-texture`;
  const gridId = `${id}-grid`;
  // The group of the trace the pointer is near (see below).
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  /** The group of the trace nearest the pointer, within `NEAR_TRACE`. */
  const groupAt = (event: MouseEvent<SVGGraphicsElement>) => {
    const toLayout = event.currentTarget.getScreenCTM()?.inverse();
    if (!toLayout) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(toLayout);
    return nearestTraceGroup(graph, layout, point, NEAR_TRACE)?.id ?? null;
  };
  const { node: size, casing, positions } = layout;
  /**
   * What a selection keeps bright (everything, or a node and its traces, or a group's traces and the
   * parts they connect), and how far the rest dims: around a group it recedes further, so its labels
   * read clearly.
   */
  const lighting = ({ selected = null, selectedGroup = null }: Selection) => {
    const group = graph.traceGroups.find((candidate) => candidate.id === selectedGroup);
    return {
      any: !!(selected || group),
      edge: (edge: GraphEdge) =>
        group
          ? group.edges.includes(edgeId(edge))
          : !selected || edge.from === selected || edge.to === selected,
      node: (id: string) => (group ? nodesOf(group).includes(id) : !selected || selected === id),
      dimmed: group ? { node: 0.15, edge: 0.1 } : { node: 0.35, edge: 0.2 },
    };
  };
  const lit = lighting({ selected, selectedGroup });
  const litBefore = lighting(from ?? {});
  /** An element's opacity, `dim` of the way from how it was lit to how it's lit now. */
  const opacityOf = (kind: "node" | "edge", wasLit: boolean, isLit: boolean) => {
    const before = wasLit ? 1 : litBefore.dimmed[kind];
    const after = isLit ? 1 : lit.dimmed[kind];
    const opacity = before + (after - before) * dim;
    return opacity === 1 ? undefined : { opacity };
  };
  /**
   * A lit trace's colour: brighter while something's selected, `dim` of the way from before. Only
   * set inline while fading from another selection (`from`), in step with the zoom.
   */
  const traceTone = (wasBright: boolean, isBright: boolean) => {
    if (!from || wasBright === isBright) return undefined;
    const bright = wasBright ? 1 - dim : dim;
    return {
      opacity: 0.5 + 0.5 * bright,
      color: `color-mix(in oklab, var(--color-violet-200) ${bright * 100}%, var(--color-violet-300))`,
    };
  };
  const canSelect = (id: string) => !!onSelect && (!targets || targets.includes(id));
  const groupsSelectable = graph.traceGroups.some((traceGroup) => canSelect(traceGroup.id));
  /** Buttons that select themselves with a click, Enter or Space (when `onSelect` is set). */
  const selectable = (id: string, label: string, pressed: boolean) =>
    onSelect && canSelect(id)
      ? {
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
        }
      : undefined;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
      {...(decorative
        ? { "aria-hidden": true }
        : // With buttons inside it's a group: an "img" would hide them from assistive tech. Named by
          // `aria-label`, not a <title>, which browsers also show as a tooltip.
          { role: onSelect ? "group" : "img", "aria-label": graph.description })}
      className={cn("h-auto w-full", grid && "overflow-visible", className)}
    >
      <defs>
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
        {/* A dot on every multiple of `GRID` (the tile is offset so its dot sits on the corner). The
            dots grow with the camera, like the rest of the board. */}
        <pattern
          id={gridId}
          x={-GRID / 2}
          y={-GRID / 2}
          width={GRID}
          height={GRID}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={GRID / 2} cy={GRID / 2} r={1} className="fill-foreground/16" />
        </pattern>
      </defs>

      {grid && (
        <rect
          x={-GRID_REACH}
          y={-GRID_REACH}
          width={layout.width + 2 * GRID_REACH}
          height={layout.height + 2 * GRID_REACH}
          fill={`url(#${gridId})`}
          className="pointer-events-none"
        />
      )}

      <g>
        <rect
          {...casing}
          rx={20}
          className="fill-[oklch(0.21_0.065_292)] stroke-violet-300/35 [stroke-dasharray:6_6] [stroke-width:1]"
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
          x={
            layout.casingLabelSide === "right"
              ? casing.x + casing.width - SCREW_INSET - 16
              : casing.x + SCREW_INSET + 16
          }
          y={casing.y + SCREW_INSET + 4}
          textAnchor={layout.casingLabelSide === "right" ? "end" : "start"}
          className="fill-violet-200/60 font-mono text-[13px]"
        >
          {graph.casingLabel}
        </text>
      </g>

      {/* Near the traces, under them: hovering or clicking picks the group of the nearest trace.
          Mouse only (keyboard users have the groups' buttons); a trace itself still wins. */}
      {onSelect && groupsSelectable && (
        <rect
          aria-hidden
          width={layout.width}
          height={layout.height}
          onPointerMove={(event) => setHoveredGroup(groupAt(event))}
          onPointerLeave={() => setHoveredGroup(null)}
          onClick={(event) => {
            const picked = groupAt(event);
            if (!picked) return;
            setHoveredGroup(null);
            onSelect(picked);
          }}
          className={cn("fill-transparent", hoveredGroup && "cursor-pointer")}
        />
      )}

      {/* The traces, one button per group: clicking any of its traces selects the group. */}
      <g>
        {graph.traceGroups.map((traceGroup) => (
          <g
            key={traceGroup.id}
            data-group={traceGroup.id}
            data-hovered={(groupsSelectable && hoveredGroup === traceGroup.id) || undefined}
            {...selectable(
              traceGroup.id,
              `${traceGroup.title}: ${traceGroup.path}`,
              selectedGroup === traceGroup.id,
            )}
            className={cn("group/trace outline-none", canSelect(traceGroup.id) && "cursor-pointer")}
          >
            {graph.edges
              .filter((edge) => traceGroup.edges.includes(edgeId(edge)))
              .map((edge) => {
                const route = edgeRoute(layout, edge);
                const [start] = route;
                const end = withGap(route, EDGE_GAP);
                const isLit = lit.edge(edge);
                const wasLit = litBefore.edge(edge);
                const tone = traceTone(litBefore.any && wasLit, lit.any && isLit);
                return (
                  <g
                    key={edgeId(edge)}
                    data-edge={edgeId(edge)}
                    style={opacityOf("edge", wasLit, isLit)}
                  >
                    {/* The trace, its arrowhead and its via in one solid colour, faded together, so
                        they read as one piece instead of overlapping see-through parts. */}
                    <g
                      style={tone}
                      className={cn(
                        "text-violet-300 opacity-50",
                        tone ? "transition-none" : "transition-[color,opacity] duration-200",
                        lit.any && isLit && "text-violet-200 opacity-100",
                        canSelect(traceGroup.id) &&
                          "group-hover/trace:text-violet-200 group-hover/trace:opacity-100 group-focus-visible/trace:text-violet-100 group-focus-visible/trace:opacity-100 group-data-hovered/trace:text-violet-200 group-data-hovered/trace:opacity-100",
                      )}
                    >
                      <polyline
                        // Stops inside the arrowhead, which covers its end.
                        points={toPoints(withGap(end, ARROW_LENGTH - 1))}
                        fill="none"
                        className={cn(
                          "stroke-current [stroke-width:1.5] [stroke-linejoin:round]",
                          edge.dashed && "[stroke-dasharray:5_5]",
                        )}
                      />
                      <polygon points={arrowhead(end)} className="fill-current" />
                      {/* Via: the pad where the trace leaves the component. */}
                      <circle
                        cx={start.x}
                        cy={start.y}
                        r={3}
                        className="fill-[oklch(0.13_0.045_292)] stroke-current [stroke-width:1.5]"
                      />
                    </g>
                    {/* Invisible and wider than the trace, so it's easy to click. */}
                    {onSelect && (
                      <polyline
                        points={toPoints(route)}
                        fill="none"
                        className="stroke-transparent"
                        strokeWidth={HIT_WIDTH}
                      />
                    )}
                  </g>
                );
              })}
          </g>
        ))}
      </g>

      <g>
        {graph.nodes.map((node) => {
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
              style={opacityOf("node", litBefore.node(node.id), lit.node(node.id))}
              className={cn("group outline-none", canSelect(node.id) && "cursor-pointer")}
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
                  "transition-[stroke] duration-200 [stroke-width:1.5]",
                  nodeStyles[node.kind],
                  canSelect(node.id) && "group-hover:stroke-violet-200",
                  selected === node.id &&
                    "stroke-violet-200 [stroke-width:2]",
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

      {children}
    </svg>
  );
};
