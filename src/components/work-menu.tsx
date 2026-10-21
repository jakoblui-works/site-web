import { LayoutGridIcon } from "lucide-react";

import { frostedMenuClassName } from "@/components/frosted-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

type WorkMenuProps = {
  projects: Project[];
};

export const WorkMenu = ({ projects }: WorkMenuProps) => {
  return (
    <DropdownMenu>
      {/* Icon + label; phones show only the icon, with the label kept for screen readers (so the
          button is still named "work") and a 44 px tap area, pulled out so the icon lines up with
          the header's edge. */}
      <DropdownMenuTrigger className="inline-flex cursor-pointer items-center gap-1.75 rounded-md py-1 font-logo text-lg leading-none font-semibold tracking-[-0.02em] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground max-sm:-mr-2.75 max-sm:size-11 max-sm:justify-center">
        {/* What shows of it stands on solid frost over the open x-ray (see `SiteHeader`). */}
        <LayoutGridIcon data-xray-solid className="size-4 max-sm:size-5.5" aria-hidden />
        <span data-xray-solid className="max-sm:sr-only">
          work
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={cn(frostedMenuClassName, "w-68")}
      >
        {projects.map((project) => (
          <DropdownMenuLinkItem
            key={project.url}
            href={project.url}
            label={project.name}
            // Highlighted, it takes the logo box's shape in a faint violet; the description stays muted.
            className="flex-col items-start gap-0.5 rounded-md px-2.5 py-2 focus:bg-primary/15 focus:text-foreground"
          >
            <span className="font-medium">{project.name}</span>
            <span className="text-[13px] text-muted-foreground!">
              {project.description}
            </span>
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
