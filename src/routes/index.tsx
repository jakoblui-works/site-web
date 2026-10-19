import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { Hero } from "@/components/hero";
import { FrostedGraph } from "@/components/frosted-graph";
import { SiteHeader } from "@/components/site-header";
import { Xray } from "@/components/xray";
import { useXrayWindow } from "@/hooks/use-xray-window";
import { graphs, type GraphId } from "@/lib/graphs";
import { isZoomTarget } from "@/lib/infra-graph";

// `?xray` opens the interior, and `?xray=<node or trace group>` also zooms into it. A bare `?xray`
// parses as an empty string, so "open" means present, not truthy; an unknown id shows the overview.
// `view` picks the x-ray's graph: absent (or unknown) is the runtime view.
const homeSearchSchema = z.object({
  xray: z.string().optional(),
  view: z
    .enum(["runtime", "deploy"] satisfies GraphId[])
    .optional()
    .catch(undefined),
});

const HomeComponent = () => {
  const { xray, view = "runtime" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const isOpen = xray !== undefined;
  const graph = graphs[view];
  const selected = xray && isZoomTarget(graph, xray) ? xray : null;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useXrayWindow(surfaceRef, panelRef, isOpen);

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
      {/* The surface (header and hero), in front of the interior. It holds the x-ray's mask values and
          strength, which its background and (while the x-ray is in use) its content read. */}
      <div
        ref={surfaceRef}
        data-open={isOpen || undefined}
        className="xray-surface relative z-10"
      >
        <div className="xray-surface-content relative z-10">
          {/* Frosted glass: a blurred copy of the interior, lined up with the real one, under black.
              It's ordinary content, so the x-ray fades it like the rest of the surface. */}
          <div
            aria-hidden
            className="xray-hole xray-surface-bg absolute inset-0 -z-10"
          >
            <FrostedGraph graphId={view} />
          </div>
          <SiteHeader />
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
        </div>
      </div>
      {/* The interior: fixed at z-0, so it sits behind the surface. */}
      <Xray
        open={isOpen}
        graphId={view}
        selected={selected}
        onSelect={(id) =>
          navigate({
            search: (search) => ({ ...search, xray: id ?? "" }),
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
