import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { graphs } from "@/lib/graphs";

import { InfraGraph } from "./infra-graph";

const graph = graphs.runtime;
const { nodes, traceGroups } = graph;
const { landscape, portrait } = graph.layouts;

const meta: Meta<typeof InfraGraph> = {
  title: "Components/InfraGraph",
  component: InfraGraph,
  args: { graph },
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
  args: { layout: landscape },
  play: showsEveryNode,
};

export const Portrait: Story = {
  args: { layout: portrait, className: "max-w-sm" },
  play: showsEveryNode,
};

export const Selectable: Story = {
  args: { layout: landscape, onSelect: fn() },
  play: async ({ args, canvas, userEvent }) => {
    for (const node of nodes) {
      await userEvent.click(
        canvas.getByRole("button", { name: `${node.label}: ${node.detail}` }),
      );
      await expect(args.onSelect).toHaveBeenLastCalledWith(node.id);
    }

    // Keyboard: nodes are focusable and select with Enter.
    const [first] = nodes;
    canvas.getByRole("button", { name: `${first.label}: ${first.detail}` }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenLastCalledWith(first.id);
  },
};

export const WithSelection: Story = {
  args: { layout: landscape, onSelect: fn(), selected: "api" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /^api:/, pressed: true }),
    ).toBeInTheDocument();
  },
};

export const SelectableTraces: Story = {
  args: { layout: landscape, onSelect: fn() },
  play: async ({ args, canvas, userEvent }) => {
    // Each group of traces is one button, and selects itself.
    for (const group of traceGroups) {
      await userEvent.click(
        canvas.getByRole("button", { name: `${group.title}: ${group.path}` }),
      );
      await expect(args.onSelect).toHaveBeenLastCalledWith(group.id);
    }
  },
};

export const WithTraceGroupSelected: Story = {
  args: { layout: landscape, onSelect: fn(), selectedGroup: "job-queue" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /^Job queue:/, pressed: true }),
    ).toBeInTheDocument();
  },
};

const deploy = graphs.deploy;

const showsEveryDeployNode: Story["play"] = async ({ canvas }) => {
  await expect(canvas.getByRole("img")).toBeVisible();
  for (const node of deploy.nodes) {
    await expect(canvas.getByText(node.label)).toBeInTheDocument();
  }
};

export const DeployLandscape: Story = {
  args: { graph: deploy, layout: deploy.layouts.landscape },
  play: showsEveryDeployNode,
};

export const DeployPortrait: Story = {
  args: { graph: deploy, layout: deploy.layouts.portrait, className: "max-w-sm" },
  play: showsEveryDeployNode,
};
