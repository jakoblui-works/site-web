import { ArrowRightIcon } from "lucide-react";
import { type Ref } from "react";

import { cn } from "@/lib/utils";

type LookInsidePanelProps = {
  onClick: () => void;
  /** The surface has a hole under this panel, so the interior shows through the glass. */
  ref?: Ref<HTMLButtonElement>;
  className?: string;
};

/**
 * A glass-covered well sunk into the surface, over a hole onto the interior. Its blur frosts the
 * interior; hovering or focusing clears the glass. Lit from above like the rest of the x-ray: the
 * surface overhangs the top edge and the lower inner rim catches the light.
 */
export const LookInsidePanel = ({
  onClick,
  ref,
  className,
}: LookInsidePanelProps) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "look-inside group relative overflow-hidden rounded-2xl border border-t-black/70 border-r-white/[0.06] border-b-white/15 border-l-white/[0.06] bg-white/[0.03] text-left shadow-[inset_0_10px_18px_-6px_rgb(0_0_0/0.75),inset_0_-1px_0_0_rgb(255_255_255/0.1)] outline-none backdrop-blur-[3px] duration-500 hover:border-b-primary/50 hover:backdrop-blur-[0px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:backdrop-blur-[0px] motion-reduce:transition-none",
        className,
      )}
    >
      {/* Depth: the top of the well lies in the surface's shadow; it lifts a little as the glass clears. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/45 via-black/10 via-35% to-transparent transition-opacity duration-500 group-hover:opacity-60 group-focus-visible:opacity-60"
      />
      <span className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-4 py-2.5 font-mono text-sm text-white backdrop-blur-md">
        Look inside
        <ArrowRightIcon
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
};
