import { Link } from "@tanstack/react-router";

import { SiteSwitcher } from "@/components/site-switcher";
import { WorkMenu } from "@/components/work-menu";
import { projects } from "@/lib/projects";
import { hub, sites } from "@/lib/sites";

// The logo reads as the domain: the box is the current subdomain (and the switcher to the other
// sites), the rest links to the current site's root.
export const SiteHeader = () => {
  return (
    <header className="h-header pt-3">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 rounded-xl ">
        <div className="flex items-center gap-1.75 font-logo text-2xl leading-none font-semibold tracking-[-0.03em]">
          <SiteSwitcher sites={sites} current={hub} />
          <Link
            to="/"
            aria-label="jakoblui home"
            className="rounded-md text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="text-primary">.</span>jakoblui
          </Link>
        </div>
        <WorkMenu projects={projects} />
      </div>
    </header>
  );
};
