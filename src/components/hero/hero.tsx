import { ArrowRightIcon, MapPinIcon } from "lucide-react";
import { type Ref } from "react";

import { buttonVariants } from "@/components/ui/button";
import { LookInsidePanel } from "@/components/xray/look-inside-panel/look-inside-panel";
import { cn } from "@/lib/utils";

import { cvUrl, profileLinks } from "./links";

type HeroProps = {
  onLookInside: () => void;
  /** The look-inside panel (wide screens): where the x-ray's window starts, and where focus returns. */
  panelRef?: Ref<HTMLButtonElement>;
  /** The look-inside button (phones, instead of the panel): same role. */
  buttonRef?: Ref<HTMLButtonElement>;
  inert?: boolean;
};

/** Lucide's arrow-right with a longer tail, so it holds its own next to bold text. */
export const TailArrow = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 28 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h18" />
    <path d="m16 5 7 7-7 7" />
  </svg>
);

export const Hero = ({
  onLookInside,
  panelRef,
  buttonRef,
  inert,
}: HeroProps) => {
  return (
    <section
      inert={inert}
      className="flex min-h-[calc(100dvh-var(--spacing-header))] items-center"
    >
      {/* The open x-ray's window always covers this, so the hero never shows on its frost. */}
      <div
        data-xray-cover
        className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-12 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16 lg:py-16"
      >
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[13px] font-medium text-muted-foreground">
            <span aria-hidden className="size-2 rounded-full bg-emerald-400" />
            Open to new roles
          </p>
          <h1 className="mt-6 font-heading text-[clamp(2.25rem,10.5vw,3.75rem)] leading-none font-bold tracking-[-0.045em] whitespace-nowrap text-neutral-200 lg:text-[clamp(4rem,6vw,5.5rem)]">
            Product <span className="text-primary">Engineer</span>
          </h1>
          <p className="mt-6 font-heading text-2xl font-semibold text-neutral-200 sm:text-4xl">
            Jakob Lui Abramson
          </p>
          <div className="mt-2 flex items-center gap-4 text-lg text-neutral-400 sm:text-xl">
            <p className="flex items-center gap-1.5 font-mono text-base sm:text-lg">
              <MapPinIcon className="size-5" aria-hidden />
              Copenhagen, Denmark
            </p>
            <ul className="flex items-center gap-1">
              {profileLinks.map(({ name, url, icon: Icon }) => (
                <li key={url}>
                  <a
                    href={url}
                    aria-label={name}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "text-neutral-400",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-300">
            I build products end to end, from interface to infrastructure. Half
            the job is knowing{" "}
            <span className="font-medium text-primary">what not to build</span>.
          </p>
          <div className="mt-8 flex flex-wrap items-start gap-3">
            <div className="flex flex-col items-start gap-2">
              <a
                href={cvUrl}
                aria-describedby="cv-caption"
                // No border, so the fill lines up with the text above it; hover lightens it (the
                // default, a see-through fill, goes muddy over the dark page).
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-14 gap-2.5 rounded-[10px] border-0 bg-clip-border px-7 text-lg font-bold hover:bg-primary-300",
                )}
              >
                Tailor my CV
                <TailArrow className="size-4.5 w-5.25" />
              </a>
              <p
                id="cv-caption"
                className="font-mono text-xs text-neutral-400"
              >
                pick a role and skills → get a PDF
              </p>
            </div>
            {/* Phones get a button instead of the panel, so the hero fits without scrolling: the
                panel's label, full width and fixed to the bottom of the screen. Blurred behind,
                since the page scrolls under it. */}
            <button
              ref={buttonRef}
              type="button"
              onClick={onLookInside}
              className="look-inside-button fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/10 text-base font-semibold text-white outline-none backdrop-blur-md transition-colors hover:bg-white/18 focus-visible:bg-white/18 focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
            >
              Look inside
              <ArrowRightIcon className="size-4.5" aria-hidden />
            </button>
          </div>
        </div>
        <LookInsidePanel
          ref={panelRef}
          onClick={onLookInside}
          className="hidden lg:flex lg:min-h-112"
        />
      </div>
    </section>
  );
};
