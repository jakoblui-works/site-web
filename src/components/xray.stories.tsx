import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { Xray } from "./xray";

const meta: Meta<typeof Xray> = {
  title: "Components/Xray",
  component: Xray,
  args: { open: true, onClose: fn() },
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Xray>;

export const ClosesWithButton: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("region", { name: "Infrastructure" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const ClosesWithEscape: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const Closed: Story = {
  args: { open: false },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.queryByRole("button", { name: "Close" })).toBeNull();
    // Closed, the interior is only seen through the panel's hole: it can't be focused or clicked.
    await expect(
      canvas.getByRole("region", { name: "Infrastructure", hidden: true }),
    ).toHaveAttribute("inert");

    // Escape does nothing while closed.
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
