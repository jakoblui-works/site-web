import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { landscapeLayout, nodes, portraitLayout } from "@/lib/infra-graph";

import { InfraGraph } from "./infra-graph";

const meta: Meta<typeof InfraGraph> = {
  title: "Components/InfraGraph",
  component: InfraGraph,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof InfraGraph>;

const showsEveryNode: Story["play"] = async ({ canvas }) => {
  await expect(canvas.getByRole("img")).toBeVisible();
  for (const node of nodes) {
    await expect(canvas.getByText(node.label)).toBeInTheDocument();
  }
};

export const Landscape: Story = {
  args: { layout: landscapeLayout },
  play: showsEveryNode,
};

export const Portrait: Story = {
  args: { layout: portraitLayout, className: "max-w-sm" },
  play: showsEveryNode,
};
