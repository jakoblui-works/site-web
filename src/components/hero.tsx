import { FileTextIcon, MapPinIcon, ScanEyeIcon } from "lucide-react";
import { type Ref } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cvUrl, profileLinks } from "@/lib/links";

import { LookInsidePanel } from "./look-inside-panel";

type HeroProps = {
  onLookInside: () => void;
  /** The look-inside panel (wide screens): where the x-ray's window starts, and where focus returns. */
  panelRef?: Ref<HTMLButtonElement>;
  /** The look-inside button (phones, instead of the panel): same role. */
  buttonRef?: Ref<HTMLButtonElement>;
  inert?: boolean;
};

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
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16 lg:py-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 font-mono text-xs font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
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
            I build products end to end, from interface to infrastructure, and
            put as much care into deciding{" "}
            <span className="font-medium text-primary">what not to build</span>.
          </p>
          <div className="mt-8 flex flex-wrap items-start gap-3">
            <div className="flex flex-col items-start gap-2">
              <a
                href={cvUrl}
                aria-describedby="cv-caption"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 gap-2 px-5 text-base",
                )}
              >
                <FileTextIcon className="size-5" aria-hidden />
                Tailor my CV
              </a>
              <p
                id="cv-caption"
                className="font-mono text-xs text-neutral-400"
              >
                pick a role and skills → get a PDF
              </p>
            </div>
            {/* Phones get a button instead of the panel, so the hero fits without scrolling. */}
            <button
              ref={buttonRef}
              type="button"
              onClick={onLookInside}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 gap-2 px-5 text-base lg:hidden",
              )}
            >
              <ScanEyeIcon className="size-5" aria-hidden />
              Look inside
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
