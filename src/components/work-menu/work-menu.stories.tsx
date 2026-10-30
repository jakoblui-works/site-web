import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";

import { projects } from "@/lib/projects";

import { WorkMenu } from "./work-menu";

const manyProjects = [
  ...projects,
  {
    name: "Second project",
    url: "https://example.jakoblui.com",
    description: "A placeholder to check the menu with more than one item.",
  },
];

const meta: Meta<typeof WorkMenu> = {
  title: "Components/WorkMenu",
  component: WorkMenu,
  args: { projects },
};
export default meta;

type Story = StoryObj<typeof WorkMenu>;

const opensWithEveryProject: Story["play"] = async ({
  args,
  canvas,
  userEvent,
}) => {
  await userEvent.click(canvas.getByRole("button", { name: "work" }));

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

// Phones show only the icon; the button keeps its name.
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
  play: opensWithEveryProject,
};
