import { graphIds, graphTitles, type GraphId } from "@/lib/graphs";
import { cn } from "@/lib/utils";

type ViewSwitchProps = {
  value: GraphId;
  /** Without it, a picture of the switch (for the page's frosted copy of the interior). */
  onChange?: (id: GraphId) => void;
  inert?: boolean;
  className?: string;
};

/**
 * Switches the x-ray between its graphs. Part of the interior, just above the window's clear area
 * (below the header on phones, where the graph is fitted below it; see `styles.css`), so it's seen
 * through the surface like the graph is.
 */
export const ViewSwitch = ({ value, onChange, inert, className }: ViewSwitchProps) => (
  <div
    data-view-switch
    inert={inert}
    {...(onChange
      ? { role: "group", "aria-label": "View" }
      : { "aria-hidden": true })}
    className={cn(
      "absolute top-(--xray-switch-top) left-1/2 z-10 flex h-(--xray-switch-height) -translate-x-1/2 gap-1 rounded-md border border-violet-300/25 bg-[oklch(0.13_0.045_292/0.85)] p-1 font-mono text-xs whitespace-nowrap",
      className,
    )}
  >
    {graphIds.map((id) => (
      <button
        key={id}
        type="button"
        tabIndex={onChange ? undefined : -1}
        aria-pressed={id === value}
        onClick={() => id !== value && onChange?.(id)}
        className={cn(
          "rounded px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // The picture is read the moment it renders, so it can't be mid-transition.
          onChange && "transition-colors",
          id === value
            ? "bg-violet-300/15 text-violet-100"
            : "text-neutral-400 hover:text-neutral-100",
        )}
      >
        {graphTitles[id]}
      </button>
    ))}
  </div>
);
