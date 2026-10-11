import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { Hero } from "@/components/hero";
import { SiteHeader } from "@/components/site-header";
import { Xray } from "@/components/xray";
import { useXrayWindow } from "@/hooks/use-xray-window";

// `?xray` opens the interior. A bare `?xray` parses as an empty string, so "open" means present, not truthy.
const homeSearchSchema = z.object({
  xray: z.string().optional(),
});

const HomeComponent = () => {
  const { xray } = Route.useSearch();
  const navigate = Route.useNavigate();
  const isOpen = xray !== undefined;

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
          strength, which its shadow, its background and (while the x-ray is in use) its content read. */}
      <div
        ref={surfaceRef}
        data-open={isOpen || undefined}
        className="xray-surface relative z-10"
      >
        <div
          aria-hidden
          className="xray-shadow xray-shadow-hole absolute inset-0 z-0"
        />
        <div className="xray-surface-content relative z-10">
          <div
            aria-hidden
            className="xray-hole xray-surface-bg absolute inset-0 -z-10"
          />
          <SiteHeader />
          <main>
            <Hero
              panelRef={panelRef}
              buttonRef={buttonRef}
              inert={isOpen}
              onLookInside={() =>
                navigate({ search: { xray: "" }, resetScroll: false })
              }
            />
          </main>
        </div>
      </div>
      {/* The interior: fixed at z-0, so it sits behind the surface. */}
      <Xray
        open={isOpen}
        onClose={() => navigate({ search: {}, resetScroll: false })}
      />
    </>
  );
};

export const Route = createFileRoute("/")({
  validateSearch: homeSearchSchema,
  component: HomeComponent,
});
