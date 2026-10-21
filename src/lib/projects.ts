export type Project = {
  name: string;
  url: string;
  description: string;
};

/** Live projects, on jakoblui.com or elsewhere (the site switcher covers the jakoblui.com sites). Supporting pages (Storybook, api docs) belong to the x-ray nodes, not here. */
export const projects: Project[] = [
  {
    name: "CV assembler",
    url: "https://cv.jakoblui.com",
    description: "Pick a title and skills, get a tailored PDF.",
  },
  {
    name: "persona",
    url: "https://persona.zip",
    description: "Online gallery for persona's art projects.",
  },
];
