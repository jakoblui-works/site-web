import { type ComponentType, type SVGProps } from "react";

import { GitHubIcon, LinkedInIcon } from "@/components/brand-icons";

export type ProfileLink = {
  name: string;
  url: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const cvUrl = "https://cv.jakoblui.com";

/** Icon links shown next to the hero's location. */
export const profileLinks: ProfileLink[] = [
  { name: "GitHub", url: "https://github.com/jakoblui-works", icon: GitHubIcon },
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/in/jakob-lui-abramson/",
    icon: LinkedInIcon,
  },
];
