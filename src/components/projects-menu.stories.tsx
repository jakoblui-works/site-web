import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";

import { projects } from "@/lib/projects";

import { ProjectsMenu } from "./projects-menu";

const manyProjects = [
  ...projects,
  {
    name: "Second project",
    url: "https://example.jakoblui.com",
    description: "A placeholder to check the menu with more than one item.",
  },
];

const meta: Meta<typeof ProjectsMenu> = {
  title: "Components/ProjectsMenu",
  component: ProjectsMenu,
  args: { projects },
};
export default meta;

type Story = StoryObj<typeof ProjectsMenu>;

const opensWithEveryProject: Story["play"] = async ({
  args,
  canvas,
  userEvent,
}) => {
  await userEvent.click(canvas.getByRole("button", { name: "Projects" }));

  // The popup is portalled outside the canvas.
  for (const project of args.projects) {
    const item = await screen.findByRole("menuitem", {
      name: new RegExp(project.name),
    });
    await expect(item).toHaveAttribute("href", project.url);
  }
};

export const Default: Story = {
  play: opensWithEveryProject,
};

export const SeveralProjects: Story = {
  args: { projects: manyProjects },
  play: opensWithEveryProject,
};
