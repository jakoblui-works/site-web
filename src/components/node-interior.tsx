import { ArrowUpRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { nodes } from "@/lib/infra-graph";
import { nodeDetails } from "@/lib/node-details";
import { cn } from "@/lib/utils";

import {
  Decisions,
  Silkscreen,
  ZoomContent,
  ZoomHeader,
  type ZoomFrameProps,
} from "./zoom-content";

/**
 * The inside of a node, seen once the camera has zoomed into it: no outline or background of its
 * own (that's the node, drawn by the graph, around it). Labelled like the droplet's casing.
 */
export const NodeInterior = ({
  nodeId,
  ...frame
}: ZoomFrameProps & { nodeId: string }) => {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  const details = nodeDetails[nodeId];
  if (!node || !details) return null;
  const titleId = `${nodeId}-interior-title`;

  return (
    <ZoomContent
      {...frame}
      titleId={titleId}
      className="justify-center px-6 py-6 sm:px-8"
    >
      <ZoomHeader
        titleId={titleId}
        title={`${node.label} · ${node.detail}`}
      />

      <div className="grid gap-7 @xl:grid-cols-[1fr_13rem]">
        <div className="flex flex-col gap-6">
          <p className="text-base leading-relaxed text-neutral-100">
            {details.summary}
          </p>

          {details.decisions.length > 0 && (
            <Decisions
              title="Why it’s built this way"
              items={details.decisions}
            />
          )}
        </div>

        {details.stack.length > 0 && (
          <section className="flex flex-col gap-3">
            <Silkscreen>Components</Silkscreen>
            <ul className="flex flex-wrap gap-x-4 gap-y-2.5 @xl:flex-col @xl:items-stretch">
              {details.stack.map((item) => (
                // A chip, with pins along both sides.
                <li
                  key={item}
                  className="relative mx-1.5 rounded-sm border border-violet-300/45 bg-[oklch(0.17_0.055_292)] px-3 py-1.5 font-mono text-xs text-violet-100 before:absolute before:inset-y-1 before:-left-[5px] before:w-1 before:bg-[repeating-linear-gradient(to_bottom,oklch(0.8_0.08_292/0.55)_0_2px,transparent_2px_5px)] after:absolute after:inset-y-1 after:-right-[5px] after:w-1 after:bg-[repeating-linear-gradient(to_bottom,oklch(0.8_0.08_292/0.55)_0_2px,transparent_2px_5px)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {details.links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {details.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1",
                )}
              >
                {link.label}
                <ArrowUpRightIcon aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </ZoomContent>
  );
};
