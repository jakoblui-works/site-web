import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { landscapeLayout, portraitLayout } from "@/lib/infra-graph";

import { InfraGraph } from "./infra-graph";

type XrayProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * The interior: fixed behind the page the whole time. The surface's mask decides how much of it
 * shows (a hole under the look-inside panel, or most of the screen when open).
 */
export const Xray = ({ open, onClose }: XrayProps) => {
  const regionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the interior itself, not Close: on wide screens Close only shows for keyboard focus,
    // which a focused button on page load (a `?xray` link) would count as.
    regionRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    // The window is sized to the screen, so the page mustn't scroll while it's open.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root.style.overflow = overflow;
    };
  }, [open, onClose]);

  return (
    <>
      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label="Infrastructure"
        inert={!open}
        data-open={open || undefined}
        className="xray-interior fixed inset-0 z-0 bg-[oklch(0.13_0.045_292)] outline-none"
      >
        <div className="xray-content flex h-dvh items-center justify-center">
          <InfraGraph
            layout={landscapeLayout}
            className="hidden size-full lg:block"
          />
          <InfraGraph layout={portraitLayout} className="size-full lg:hidden" />
        </div>
      </section>
      {open && (
        <>
          {/* Phones: a visible Close. Wide screens: only for keyboard users (shown on focus), since
              Escape and clicking the edge close it there. */}
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 gap-2 animate-in fade-in duration-500 motion-reduce:animate-none lg:not-focus-visible:sr-only lg:top-[calc(var(--spacing-header)+1.5rem)] lg:right-8 lg:bottom-auto lg:left-auto lg:translate-x-0"
          >
            <XIcon aria-hidden />
            Close
          </Button>
          {/* Wide screens: clicking the faded edge band closes. Invisible, outside the graph. */}
          <div aria-hidden className="hidden lg:block">
            <div
              onClick={onClose}
              className="fixed inset-y-0 left-0 z-40 w-[7vw]"
            />
            <div
              onClick={onClose}
              className="fixed inset-y-0 right-0 z-40 w-[7vw]"
            />
            <div
              onClick={onClose}
              className="fixed inset-x-0 bottom-0 z-40 h-[8vh]"
            />
          </div>
          <p className="pointer-events-none fixed inset-x-0 bottom-5 z-50 hidden text-center font-mono text-xs text-neutral-400 animate-in fade-in duration-700 motion-reduce:animate-none lg:block">
            press{" "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-neutral-200">
              esc
            </kbd>{" "}
            to exit
          </p>
        </>
      )}
    </>
  );
};
