import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { expect } from "storybook/test";

import { NotFound } from "./not-found";

const meta: Meta<typeof NotFound> = {
  title: "Components/NotFound",
  component: NotFound,
  args: { path: "/some/missing/page" },
  parameters: { layout: "fullscreen" },
  // Its button is a router link; on the page's frost, as the 404 page shows it.
  decorators: [
    (Story) => (
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({
            component: () => (
              <div className="not-found-page min-h-dvh overflow-x-clip">
                <Story />
              </div>
            ),
          }),
          history: createMemoryHistory(),
        })}
      />
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof NotFound>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByText(`GET ${args.path}`)).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};
