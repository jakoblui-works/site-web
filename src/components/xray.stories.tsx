import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";

import { graphs } from "@/lib/graphs";

import { Xray } from "./xray";

const meta: Meta<typeof Xray> = {
  title: "Components/Xray",
  component: Xray,
  args: { open: true, graphId: "runtime", onGraphChange: fn(), selected: null, parent: null, onSelect: fn(), onClose: fn() },
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

export const OpenNode: Story = {
  args: { selected: "api" },
  play: async ({ args, canvas, userEvent }) => {
    // The camera zooms into the node, and its internals come into view inside it.
    const heading = await canvas.findByRole("heading", { name: /^api/ });
    await waitFor(() => expect(heading).toBeVisible(), { timeout: 2000 });
    await expect(
      canvas.getByRole("complementary", { name: /^api/ }),
    ).toContainElement(canvas.getByText("FastAPI", { selector: "li" }));

    // Escape steps back to the overview first, not out of the x-ray.
    await userEvent.keyboard("{Escape}");
    await expect(args.onSelect).toHaveBeenCalledWith(null);
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

export const ZoomsOutOnScroll: Story = {
  args: { selected: "api" },
  play: async ({ args, canvas }) => {
    const heading = await canvas.findByRole("heading", { name: /^api/ });
    await waitFor(() => expect(heading).toBeVisible(), { timeout: 2000 });

    // Scrolling up doesn't leave; scrolling down zooms back out of the node.
    const region = canvas.getByRole("region", { name: "Infrastructure" });
    region.dispatchEvent(new WheelEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true }));
    await expect(args.onSelect).not.toHaveBeenCalled();
    region.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, bubbles: true, cancelable: true }));
    await expect(args.onSelect).toHaveBeenCalledWith(null);
  },
};

/** The node's button in the layout shown at this width (the other one isn't displayed). */
const shownNode = (canvasElement: HTMLElement, id: string) =>
  [...canvasElement.querySelectorAll(`[data-node="${id}"]`)].find(
    (element) => element.getClientRects().length > 0,
  );
const scroll = (target: Element | undefined, deltaY: number) =>
  target?.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
const cameraScale = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>(".xray-camera")?.style.transform.match(/scale\(([\d.]+)\)/)?.[1];

export const ZoomsInOnScroll: Story = {
  play: async ({ args, canvasElement }) => {
    // Scrolling up over a node zooms into it: far enough, and it carries on in by itself.
    scroll(shownNode(canvasElement, "api"), -400);
    await expect(args.onSelect).toHaveBeenCalledWith("api");
  },
};

export const SettlesBackFromShortScroll: Story = {
  play: async ({ args, canvasElement }) => {
    // A little way in, the camera follows; let go there and it settles back to the overview.
    scroll(shownNode(canvasElement, "api"), -60);
    await waitFor(() => expect(Number(cameraScale(canvasElement))).toBeGreaterThan(1));
    await waitFor(() => expect(cameraScale(canvasElement)).toBe("1"), { timeout: 2500 });
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const NoZoomOverEmptySpace: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    // Away from every node and trace (the top-left corner), there's nothing to zoom into.
    canvas
      .getByRole("region", { name: "Infrastructure" })
      .dispatchEvent(new WheelEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true }));
    await expect(cameraScale(canvasElement)).toBe("1");
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const ClosesOnScrollOut: Story = {
  play: async ({ args, canvas }) => {
    const region = canvas.getByRole("region", { name: "Infrastructure" });
    // In the overview, a little scrolling down doesn't leave; as far as leaving a node takes does.
    scroll(region, 60);
    await expect(args.onClose).not.toHaveBeenCalled();
    scroll(region, 200);
    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const ZoomsOutWithArrow: Story = {
  args: { selected: "api" },
  play: async ({ args, canvas, userEvent }) => {
    // The arrow above the hint steps back one level: out of the node, not out of the x-ray.
    await userEvent.click(await canvas.findByRole("button", { name: "Zoom out" }));
    await expect(args.onSelect).toHaveBeenCalledWith(null);
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

export const ExitsWithArrow: Story = {
  play: async ({ args, canvas }) => {
    // In the overview the arrow leaves the x-ray. It shows on wide screens only (phones have Close),
    // so it's clicked directly here, whatever the test browser's width.
    canvas.getByRole("button", { name: "Exit the x-ray", hidden: true }).click();
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const EdgeZoomsOutWhenZoomedIn: Story = {
  args: { selected: "api" },
  play: async ({ args, canvasElement }) => {
    // Zoomed in, traces run under the faded edge band: clicking it zooms out, it doesn't close.
    for (const zone of canvasElement.querySelectorAll<HTMLElement>("[data-edge-zone]")) {
      zone.click();
    }
    await expect(args.onSelect).toHaveBeenCalledWith(null);
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

export const TraceGroup: Story = {
  args: { selected: "job-queue" },
  play: async ({ args, canvas, userEvent }) => {
    const group = graphs.runtime.traceGroups.find((candidate) => candidate.id === "job-queue");
    const firstLine = Object.values(group?.labels ?? {})[0][0];

    // The labels only appear once the camera has framed the group.
    const label = await canvas.findByText(firstLine);
    await expect(label).not.toBeVisible();
    await waitFor(() => expect(label).toBeVisible(), { timeout: 2500 });
    await expect(canvas.getByRole("complementary", { name: /^Job queue/ })).toBeInTheDocument();

    // Leaving works as it does for nodes.
    await userEvent.keyboard("{Escape}");
    await expect(args.onSelect).toHaveBeenCalledWith(null);
  },
};

export const EntersNodeFromGroup: Story = {
  args: { selected: "job-queue" },
  play: async ({ args, canvas, userEvent }) => {
    const group = graphs.runtime.traceGroups.find((candidate) => candidate.id === "job-queue");
    const firstLine = Object.values(group?.labels ?? {})[0][0];
    await waitFor(() => expect(canvas.getByText(firstLine)).toBeVisible(), { timeout: 2500 });

    // Once the camera rests there, the group's nodes zoom in from its view; the rest aren't buttons.
    const redis = (
      await canvas.findAllByRole("button", { name: /^Redis:/ }, { timeout: 2500 })
    ).find((element) => element.getClientRects().length > 0);
    await expect(canvas.queryByRole("button", { name: /^Postgres:/ })).toBeNull();
    if (redis) await userEvent.click(redis);
    await expect(args.onSelect).toHaveBeenCalledWith("redis", "job-queue");
  },
};

export const NodeFromGroupZoomsOutToGroup: Story = {
  args: { selected: "redis", parent: "job-queue" },
  play: async ({ args, canvas, userEvent }) => {
    const heading = await canvas.findByRole("heading", { name: /^Redis/ });
    await waitFor(() => expect(heading).toBeVisible(), { timeout: 2500 });

    // Zooming out goes back to the group it was entered from, not to the overview.
    await userEvent.keyboard("{Escape}");
    await expect(args.onSelect).toHaveBeenCalledWith("job-queue");
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

export const SwitchesView: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const views = canvas.getByRole("group", { name: "View" });
    await expect(within(views).getByRole("button", { name: "Runtime" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(views).getByRole("button", { name: "Build & deploy" }));
    await expect(args.onGraphChange).toHaveBeenCalledWith("deploy");
    // The view already shown does nothing.
    await userEvent.click(within(views).getByRole("button", { name: "Runtime" }));
    await expect(args.onGraphChange).toHaveBeenCalledOnce();
  },
};

export const DeployView: Story = {
  args: { graphId: "deploy" },
  play: async ({ canvas }) => {
    for (const node of graphs.deploy.nodes) {
      await expect(canvas.getByRole("button", { name: `${node.label}: ${node.detail}` })).toBeInTheDocument();
    }
    await expect(canvas.getByRole("button", { name: "Build & deploy", pressed: true })).toBeInTheDocument();
  },
};

export const NoViewSwitchWhenZoomed: Story = {
  args: { selected: "api" },
  play: async ({ canvasElement }) => {
    // Faded out, and out of reach.
    await expect(canvasElement.querySelector("[data-view-switch]")).toHaveAttribute("inert");
  },
};
