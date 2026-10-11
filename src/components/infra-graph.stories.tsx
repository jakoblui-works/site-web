import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { landscapeLayout, nodes, portraitLayout } from "@/lib/infra-graph";
import { traceGroups } from "@/lib/trace-groups";

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

export const Selectable: Story = {
  args: { layout: landscapeLayout, onSelect: fn() },
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
  args: { layout: landscapeLayout, onSelect: fn(), selected: "api" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /^api:/, pressed: true }),
    ).toBeInTheDocument();
  },
};

export const SelectableTraces: Story = {
  args: { layout: landscapeLayout, onSelect: fn() },
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
  args: { layout: landscapeLayout, onSelect: fn(), selectedGroup: "job-queue" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /^Job queue:/, pressed: true }),
    ).toBeInTheDocument();
  },
};
