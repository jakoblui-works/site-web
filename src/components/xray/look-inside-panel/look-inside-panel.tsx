import { ArrowRightIcon } from "lucide-react";
import { type Ref } from "react";

import { cn } from "@/lib/utils";

type LookInsidePanelProps = {
  onClick: () => void;
  /** Where focus returns when the x-ray closes. */
  ref?: Ref<HTMLButtonElement>;
  className?: string;
};

/**
 * Faintly violet frosted glass over a picture of the interior behind it (see `.look-inside-view`);
 * hovering or focusing clears the frost and strengthens the violet. Its label is a flat secondary
 * button, so the hero keeps a single primary one.
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
        "look-inside group relative cursor-pointer overflow-hidden rounded-2xl text-left outline-none duration-500 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
        className,
      )}
    >
      <span aria-hidden className="look-inside-view absolute inset-0" />
      <span
        aria-hidden
        className="look-inside-view look-inside-view-clear absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-primary/10 transition-colors duration-500 group-hover:bg-primary/16 group-focus-visible:bg-primary/16 motion-reduce:transition-none"
      />
      <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 text-base font-semibold text-white transition-colors group-hover:bg-white/18 group-focus-visible:bg-white/18">
        Look inside
        <ArrowRightIcon
          className="size-4.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
};
