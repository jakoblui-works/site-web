import { graphs } from "@/lib/graphs";

import { InfraGraph } from "./infra-graph";

const runtime = graphs.runtime;

// The window onto the interior: sharp in the middle, fading out towards the card's edges.
const windowMask =
  "radial-gradient(ellipse 62% 66% at 66% 46%, #000 42%, transparent 100%)";
// Keeps the type readable where it runs over the board: the surface colour, fading out.
const scrim =
  "radial-gradient(ellipse 52% 58% at 26% 68%, oklch(0.06 0.015 292) 30%, transparent 100%)";

/**
 * The link preview image (og:image), 1200×630: the role and name over the circuit board, which
 * shows through a soft window on the right like the x-ray. Everything to read stays inside the
 * central safe zone and X's 16:9 crop. Rendered to `public/og.png` by `pnpm og`.
 */
export const OgCard = () => {
  return (
    <div
      data-og-card
      className="relative h-[630px] w-[1200px] overflow-hidden bg-[oklch(0.06_0.015_292)]"
    >
      <div
        className="absolute inset-y-0 right-0 flex w-[840px] items-center bg-[oklch(0.13_0.045_292)] px-10 opacity-85"
        style={{ maskImage: windowMask }}
      >
        <InfraGraph graph={runtime} layout={runtime.layouts.landscape} decorative />
      </div>
      <div className="absolute inset-0" style={{ backgroundImage: scrim }} />
      {/* A faint violet edge, so the card doesn't turn into a black box in dark feeds. */}
      <div className="absolute inset-0 shadow-[inset_0_0_0_1px_oklch(0.702_0.183_293.541/0.35),inset_0_0_72px_oklch(0.702_0.183_293.541/0.14)]" />

      <div className="relative flex h-full flex-col px-24 py-18">
        {/* The header's logo, without the menu. */}
        <div className="flex items-center gap-2 font-logo text-[28px] leading-none font-semibold tracking-[-0.03em] text-foreground">
          <span className="notch inline-flex items-center rounded-lg bg-primary py-1 pr-4 pl-2 text-[24px] tracking-[-0.02em] text-primary-foreground">
            www
          </span>
          <span>
            <span className="text-primary">.</span>jakoblui
          </span>
        </div>
        <div className="flex-1" />
        <h1 className="font-heading text-[150px] leading-[0.86] font-bold tracking-[-0.055em] text-neutral-200">
          Product
          <span className="block text-primary">Engineer</span>
        </h1>
        <p className="mt-8 font-heading text-[50px] leading-none font-semibold tracking-[-0.02em] text-neutral-200">
          Jakob Lui Abramson
        </p>
      </div>
    </div>
  );
};
