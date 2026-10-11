import { ChevronDownIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Project } from "@/lib/projects";

type ProjectsMenuProps = {
  projects: Project[];
};

export const ProjectsMenu = ({ projects }: ProjectsMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "ghost" })}>
        Projects
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {projects.map((project) => (
          <DropdownMenuLinkItem
            key={project.url}
            href={project.url}
            label={project.name}
            className="flex-col items-start gap-0.5"
          >
            <span className="font-medium">{project.name}</span>
            <span className="text-muted-foreground">
              {project.description}
            </span>
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
