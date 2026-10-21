export type Project = {
  name: string;
  url: string;
  description: string;
};

/** Live projects, each on its own subdomain. Supporting pages (Storybook, api docs) belong to the x-ray nodes, not here. */
export const projects: Project[] = [
  {
    name: "CV assembler",
    url: "https://cv.jakoblui.com",
    description: "Pick a title and skills, get a tailored PDF.",
  },
];
