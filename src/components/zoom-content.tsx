import { type ReactNode, type Ref } from "react";

import { cn } from "@/lib/utils";

/** Where zoomed-in content is drawn this frame (set by `Xray`). */
export type ZoomFrameProps = {
  /** On screen right now (px): part of the zoomed scene, so it moves and scales with it. */
  rect: { left: number; top: number; width: number; height: number } | null;
  /** Its layout size (px, unscaled): laid out at it throughout, so it never reflows. */
  width: number;
  height: number;
  /** How large it's drawn now, relative to its layout. */
  scale: number;
  opacity: number;
  /** Scrolls (once zoomed in, if it doesn't fit). */
  scrollable: boolean;
  ref?: Ref<HTMLElement>;
  contentRef?: Ref<HTMLDivElement>;
};

/**
 * Content that's part of the zoomed scene (a node's internals, a group's notes): no outline of its
 * own, drawn where the camera puts it, at the scale the zoom has reached.
 */
export const ZoomContent = ({
  titleId,
  rect,
  width,
  height,
  scale,
  opacity,
  scrollable,
  ref,
  contentRef,
  className,
  children,
}: ZoomFrameProps & { titleId: string; className?: string; children: ReactNode }) => (
  <aside
    ref={ref}
    tabIndex={-1}
    aria-labelledby={titleId}
    style={
      rect ?? { left: 0, top: 0, visibility: "hidden" } // Not placed yet: only measured.
    }
    className={cn(
      "absolute z-10 overflow-x-hidden text-left outline-none",
      scrollable ? "overflow-y-auto" : "overflow-y-hidden",
    )}
  >
    <div
      ref={contentRef}
      style={{
        width,
        minHeight: height || undefined,
        opacity,
        transform: `scale(${scale})`,
      }}
      className={cn("@container flex origin-top-left flex-col gap-6", className)}
    >
      {children}
    </div>
  </aside>
);

/** Section heading, like the silkscreen labels printed on a board. */
export const Silkscreen = ({ children }: { children: string }) => (
  <h3 className="font-mono text-[11px] tracking-widest text-violet-200/55 uppercase">
    {children}
  </h3>
);

/** A label printed on the board, like the droplet casing's. */
export const ZoomHeader = ({ titleId, title }: { titleId: string; title: string }) => (
  <h2 id={titleId} className="font-mono text-[13px] text-violet-200/60">
    {title}
  </h2>
);

/** Why it's built this way, one line each, drawn as traces with a via at their start. */
export const Decisions = ({ title, items }: { title: string; items: string[] }) => (
  <section className="flex flex-col gap-3">
    <Silkscreen>{title}</Silkscreen>
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item}
          className="relative border-l-[1.5px] border-violet-300/50 pl-4 text-[13px] leading-relaxed text-neutral-300 before:absolute before:top-0 before:-left-[5px] before:size-2 before:rounded-full before:border-[1.5px] before:border-violet-300/70 before:bg-[oklch(0.13_0.045_292)]"
        >
          {item}
        </li>
      ))}
    </ul>
  </section>
);
