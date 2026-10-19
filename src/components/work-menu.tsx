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
      <DropdownMenuTrigger className="notch-left cursor-pointer rounded-md py-1 pl-3 font-logo text-lg leading-none font-semibold tracking-[-0.02em] text-muted-foreground transition-colors outline-none [--notch-color:var(--muted-foreground)] hover:text-foreground hover:[--notch-color:var(--primary)] focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground data-popup-open:[--notch-color:var(--primary)]">
        work
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
