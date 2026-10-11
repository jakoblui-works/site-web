import { type CSSProperties, type Ref } from "react";

import { edgeId, labelAnchor, type Graph, type GraphLayout } from "@/lib/infra-graph";
import { LABEL_STYLE } from "@/lib/trace-groups";
import { throughCamera, toStage, type Camera, type ZoomPlan } from "@/lib/zoom";

/**
 * A group of traces' labels, printed on the board next to each trace once the camera has framed
 * the group: no background, the same mono as the casing's label, a fixed size. Each sits at its
 * hand-placed spot (the layout's `labels`) and follows the camera.
 */
export const TraceLabels = ({
  graph,
  groupId,
  layout,
  plan,
  camera,
  opacity,
  ref,
  contentRef,
}: {
  graph: Graph;
  groupId: string;
  layout: GraphLayout;
  plan: ZoomPlan | null;
  camera: Camera;
  opacity: number;
  ref?: Ref<HTMLElement>;
  contentRef?: Ref<HTMLDivElement>;
}) => {
  const group = graph.traceGroups.find((candidate) => candidate.id === groupId);
  if (!group) return null;
  const titleId = `${groupId}-labels-title`;
  const pxPerUnit = plan ? plan.fit * camera.scale : 1;

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden outline-none"
    >
      <div ref={contentRef} style={{ opacity }}>
        <h2 id={titleId} className="sr-only">
          {group.title} · {group.path}
        </h2>
        {plan &&
          graph.edges
            .filter((edge) => group.edges.includes(edgeId(edge)))
            .map((edge) => {
              const spot = layout.labels?.[edgeId(edge)];
              if (!spot) return null;
              const at = throughCamera(
                camera,
                toStage(layout, plan.stage, labelAnchor(layout, edge, spot)),
                plan.stage,
              );
              // Off the line, or (`clear`) past the nodes it runs between too.
              const offset =
                LABEL_STYLE.offset + (spot.clear ? (layout.node.height / 2) * pxPerUnit : 0);
              const placed: Record<typeof spot.side, CSSProperties> = {
                above: { transform: `translate(-50%, calc(-100% - ${offset}px))`, textAlign: "center" },
                below: { transform: `translate(-50%, ${offset}px)`, textAlign: "center" },
                left: { transform: `translate(calc(-100% - ${offset}px), -50%)`, textAlign: "right" },
                right: { transform: `translate(${offset}px, -50%)`, textAlign: "left" },
              };
              return (
                <div
                  key={edgeId(edge)}
                  style={{ left: at.x, top: at.y, ...placed[spot.side] }}
                  className="absolute font-mono text-[11px] leading-[1.375] whitespace-nowrap lg:text-[13px]"
                >
                  {group.labels[edgeId(edge)].map((line, index) => (
                    // Phones have room for the first line only.
                    <p
                      key={line}
                      className={index === 0 ? "text-violet-100" : "text-violet-200/60 max-lg:hidden"}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              );
            })}
      </div>
    </aside>
  );
};
