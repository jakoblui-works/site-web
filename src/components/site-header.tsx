import { Link } from "@tanstack/react-router";

import { ProjectsMenu } from "@/components/projects-menu";
import { projects } from "@/lib/projects";

export const SiteHeader = () => {
  return (
    <header className="h-header border-b bg-surface">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-md bg-primary text-base font-extrabold tracking-tight text-primary-foreground"
          >
            JL
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Jakob Lui
          </span>
        </Link>
        <ProjectsMenu projects={projects} />
      </div>
    </header>
  );
};
