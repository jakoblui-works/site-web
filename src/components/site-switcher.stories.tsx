import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";

import { sites } from "@/lib/sites";

import { SiteSwitcher } from "./site-switcher";

const meta: Meta<typeof SiteSwitcher> = {
  title: "Components/SiteSwitcher",
  component: SiteSwitcher,
  args: { sites, current: sites[0] },
};
export default meta;

type Story = StoryObj<typeof SiteSwitcher>;

const opensWithTheOtherSites: Story["play"] = async ({
  args,
  canvas,
  userEvent,
}) => {
  const trigger = canvas.getByRole("button", { name: "Switch site" });
  await expect(trigger).toHaveTextContent(args.current.subdomain);
  await userEvent.click(trigger);

  // The popup is portalled outside the canvas. The current site is the trigger, so it isn't listed.
  const others = args.sites.filter((site) => site.url !== args.current.url);
  const items = await screen.findAllByRole("menuitem");
  await expect(items).toHaveLength(others.length);
  for (const site of others) {
    const item = screen.getByRole("menuitem", { name: new RegExp(site.label) });
    await expect(item).toHaveAttribute("href", site.url);
  }
};

export const OnTheHub: Story = {
  play: opensWithTheOtherSites,
};

export const OnASubdomain: Story = {
  args: { current: sites[1] },
  play: opensWithTheOtherSites,
};
