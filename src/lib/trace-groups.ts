/** Placing a group of traces and its labels once zoomed in. */

import {
  edgeId,
  edgeRoute,
  type Graph,
  type GraphLayout,
  type Rect,
  type TraceGroup,
} from "./infra-graph";

/**
 * How labels are set (px): a fixed size, wide screens and narrow (where only the first line shows),
 * this far from their trace. The font is mono, so a line is `charWidth` em per character.
 */
/** On narrow screens, how many screen widths a framed group may span (it's cropped at the sides). */
export const NARROW_CROP = 1.4;

export const LABEL_STYLE = {
  offset: 10,
  fontSize: { wide: 13, narrow: 11 },
  lineHeight: 1.375,
  charWidth: 0.6,
};

/** The group a trace (by `edgeId`) belongs to. */
export const traceGroupOf = (graph: Graph, id: string) =>
  graph.traceGroups.find((group) => group.edges.includes(id));

/** The area a group covers in a layout (viewBox units): its traces and the parts they connect. */
export const traceArea = (
  graph: Graph,
  layout: GraphLayout,
  group: TraceGroup,
): Rect => {
  const groupEdges = graph.edges.filter((edge) => group.edges.includes(edgeId(edge)));
  const { width, height } = layout.node;
  const points = groupEdges.flatMap((edge) => [
    ...edgeRoute(layout, edge),
    ...[edge.from, edge.to].flatMap((id) => {
      const { x, y } = layout.positions[id];
      return [
        { x: x - width / 2, y: y - height / 2 },
        { x: x + width / 2, y: y + height / 2 },
      ];
    }),
  ]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};
