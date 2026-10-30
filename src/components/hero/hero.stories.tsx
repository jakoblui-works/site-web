import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { Hero } from "./hero";
import { cvUrl, profileLinks } from "./links";

const meta: Meta<typeof Hero> = {
  title: "Components/Hero",
  component: Hero,
  args: { onLookInside: fn() },
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Hero>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Tailor my CV" })).toHaveAttribute(
      "href",
      cvUrl,
    );
    for (const link of profileLinks) {
      await expect(
        canvas.getByRole("link", { name: link.name }),
      ).toHaveAttribute("href", link.url);
    }
    await expect(canvas.getByText(/Copenhagen/)).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Look inside" }));
    await expect(args.onLookInside).toHaveBeenCalledOnce();
  },
};
