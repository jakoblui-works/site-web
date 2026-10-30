import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { AppHeader } from "@/components/app-header/app-header";
import { Hero } from "@/components/hero/hero";
import { FrostedGraph } from "@/components/xray/frosted-graph/frosted-graph";
import { InfraOutline } from "@/components/xray/infra-outline/infra-outline";
import { Xray } from "@/components/xray/xray/xray";
import { useXrayWindow } from "@/hooks/use-xray-window";
import { graphs, type GraphId } from "@/lib/graphs";
import { isZoomTarget } from "@/lib/infra-graph";
import { enterableFrom } from "@/lib/trace-groups";

/** How long the x-ray fades in or out (the interior's opacity transition in `styles.css`). */
const FADE_MS = 800;

// `?xray` opens the interior, and `?xray=<node or trace group>` also zooms into it. A bare `?xray`
// parses as an empty string, so "open" means present, not truthy; an unknown id shows the overview.
// `view` picks the x-ray's graph: absent (or unknown) is the runtime view. `group` is the group of
// traces a node was entered from (zooming out goes back to it); ignored unless the node is on it.
const homeSearchSchema = z.object({
  xray: z.string().optional(),
  group: z.string().optional(),
  view: z
    .enum(["runtime", "deploy"] satisfies GraphId[])
    .optional()
    .catch(undefined),
});

const HomeComponent = () => {
  const { xray, group, view = "runtime" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const isOpen = xray !== undefined;
  const graph = graphs[view];
  const selected = xray && isZoomTarget(graph, xray) ? xray : null;
  const parent = group && selected && enterableFrom(graph, group).includes(selected) ? group : null;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Once the fade is done, the open x-ray settles into its other arrangement (see `styles.css`);
  // closing leaves it at once. Opened on a `?xray` link, it starts settled.
  const [fadedIn, setFadedIn] = useState(isOpen);
  useEffect(() => {
    if (!isOpen) {
      setFadedIn(false);
      return;
    }
    const timer = setTimeout(() => setFadedIn(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);
  const settled = isOpen && fadedIn;
  useXrayWindow(surfaceRef, settled);

  // After closing, return focus to whichever look-inside control is shown (not on the first render).
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const panel = panelRef.current;
      const trigger = panel?.getClientRects().length ? panel : buttonRef.current;
      trigger?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <>
      {/* The surface (header and hero), under the interior. */}
      <div
        ref={surfaceRef}
        data-open={isOpen || undefined}
        data-settled={settled || undefined}
        className="xray-surface relative z-10"
      >
        <div className="xray-surface-content relative z-10">
          {/* Frosted glass: a blurred copy of the interior, lined up with the real one, under black.
              It also draws the look-inside panel's picture of the interior. */}
          <div aria-hidden className="xray-surface-bg absolute inset-0 -z-10">
            <FrostedGraph graphId={view} open={isOpen} />
          </div>
          <AppHeader />
          <main>
            <Hero
              panelRef={panelRef}
              buttonRef={buttonRef}
              inert={isOpen}
              onLookInside={() =>
                navigate({
                  search: (search) => ({ ...search, xray: "" }),
                  resetScroll: false,
                })
              }
            />
          </main>
          <InfraOutline inert={isOpen} />
        </div>
      </div>
      {/* The interior: fixed on top of the surface, seen through the window while open. */}
      <Xray
        open={isOpen}
        graphId={view}
        selected={selected}
        parent={parent}
        onSelect={(id, from) =>
          navigate({
            search: (search) => ({ ...search, xray: id ?? "", group: from }),
            resetScroll: false,
          })
        }
        // Back to the new view's overview (the default view stays out of the URL).
        onGraphChange={(next) =>
          navigate({
            search: { xray: "", view: next === "runtime" ? undefined : next },
            resetScroll: false,
          })
        }
        // Closing keeps the view: the x-ray fades out on the graph that was shown, the look-inside
        // panel keeps showing it, and opening again comes back to it.
        onClose={() =>
          navigate({
            search: ({ view }) => ({ view }),
            resetScroll: false,
          })
        }
      />
    </>
  );
};

export const Route = createFileRoute("/")({
  validateSearch: homeSearchSchema,
  component: HomeComponent,
});
