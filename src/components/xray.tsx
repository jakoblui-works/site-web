import { XIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  SNAPSHOTS,
  SnapshotLayer,
  useZoomSnapshots,
  type Snapshot,
} from "@/hooks/use-zoom-snapshots";
import { graphs, type GraphId } from "@/lib/graphs";
import { isZoomTarget } from "@/lib/infra-graph";
import { measureStage } from "@/lib/stage";
import {
  enterableFrom,
  NARROW_CROP,
  NEAR_TRACE,
  nearestTraceGroup,
  traceArea,
} from "@/lib/trace-groups";
import { cn } from "@/lib/utils";
import {
  contentWidth,
  ease,
  easeInverse,
  IDENTITY,
  planFrameZoom,
  planZoom,
  ramp,
  zoomFrame,
  type Camera,
  type ZoomPlan,
} from "@/lib/zoom";

import { InfraGraph } from "./infra-graph";
import { NodeInterior } from "./node-interior";
import { TraceLabels } from "./trace-labels";
import { ViewSwitch } from "./view-switch";
import type { ZoomFrameProps } from "./zoom-content";

/** Wide screens show the landscape graph (Tailwind's `lg`). */
const WIDE = 1024;

/** How long switching graphs cross-fades (matches the switch's `duration-500`). */
const SWITCH_MS = 500;

/** How long zooming into (or out of) a node takes. */
const ZOOM_MS = 1100;

/**
 * Zooming by gesture: how far a gesture moves the (eased) zoom per px of scrolling, of trackpad
 * pinching (ctrl+wheel) and per doubling of the distance between two fingers; and where it stops
 * scrubbing and carries on by itself, into a node or group (a quarter of the way in) or out of it (a
 * quarter of the way out).
 */
const SCROLL_PX = 600;
const TRACKPAD_PINCH_PX = 200;
const TOUCH_PINCH_GAIN = 0.6;
const ENTER_ABOVE = 0.25;
const LEAVE_BELOW = 0.75;
/**
 * How long scrolling has to pause (ms) before a zoom-out that didn't get that far settles back in:
 * longer than the gap between a mouse wheel's notches, so slow scrolling doesn't pull back in between.
 */
const SETTLE_MS = 400;

/**
 * How far the rest of the graph has dimmed at `t`: as a node's header fades, and as the target's
 * snapshot fades in over the start's, so the live graph and its snapshots always match.
 */
const dimAt = (t: number) => ramp(t, 0.15, 0.5);

/**
 * How far the camera is into a node or group of traces: 0 where the zoom starts, 1 inside it. Into a
 * node from a group's view, `parent` is the group's zoom, and it starts where that one rests.
 */
type View = { plan: ZoomPlan; t: number; parent?: ZoomPlan };
/** A zoom, whatever how far it's got. */
type Zoom = Omit<View, "t">;

/** A snapshot in the scene this frame (see `layersAt`). */
type SceneLayer = { kind: string; snapshot: Snapshot; opacity: number };

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-neutral-200">
    {children}
  </kbd>
);

type XrayProps = {
  open: boolean;
  /** The graph shown (the URL's `view`). */
  graphId: GraphId;
  /** Switch to another graph (from its overview). */
  onGraphChange: (id: GraphId) => void;
  /** The selected node or group of traces, which the camera zooms into. */
  selected: string | null;
  /** The group of traces the selected node was entered from: zooming out goes back to it. */
  parent: string | null;
  /**
   * Select a node or group of traces (a node entered from the group `parent`'s view), or go back to
   * the overview with `null`.
   */
  onSelect: (id: string | null, parent?: string) => void;
  onClose: () => void;
};

/**
 * The interior: fixed on top of the page the whole time, seen through the window (see `styles.css`);
 * invisible while closed, when the look-inside panel shows a picture of it instead.
 */
export const Xray = ({
  open,
  graphId,
  onGraphChange,
  selected,
  parent,
  onSelect,
  onClose,
}: XrayProps) => {
  const graph = graphs[graphId];
  const { landscape, portrait } = graph.layouts;
  const isGroup = (id: string | null) => graph.traceGroups.some((group) => group.id === id);

  // Switching graphs cross-fades: the one left stays on top and fades out over the new one, which
  // fades in. (Adjusted while rendering, so the old one never disappears for a frame.)
  const [shownId, setShownId] = useState(graphId);
  const [leaving, setLeaving] = useState<GraphId | null>(null);
  if (graphId !== shownId) {
    setShownId(graphId);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(reduced ? null : shownId);
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), SWITCH_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  const regionRef = useRef<HTMLElement>(null);

  // The latest props for the handlers, so their effects only run when opening, closing or selecting.
  const latest = useRef({ selected, parent, onSelect, onClose });
  useEffect(() => {
    latest.current = { selected, parent, onSelect, onClose };
  });
  // Zooming out goes back one level: from a node entered from a group of traces to the group, from
  // a node or group to the overview.
  const zoomOut = () => {
    const { parent, onSelect } = latest.current;
    if (parent) onSelect(parent);
    else onSelect(null);
  };
  // Leaving steps back one level, and from the overview out of the x-ray (Escape, the arrow, and on
  // wide screens the faded edge band).
  const stepBack = () => {
    if (latest.current.selected) zoomOut();
    else latest.current.onClose();
  };

  useEffect(() => {
    if (!open) return;
    // Focus the interior itself, not Close: on wide screens Close only shows for keyboard focus,
    // which a focused button on page load (a `?xray` link) would count as.
    regionRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") stepBack();
    };
    window.addEventListener("keydown", onKeyDown);
    // The window is sized to the screen, so the page mustn't scroll while it's open.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root.style.overflow = overflow;
    };
  }, [open]);

  // Selecting a node zooms into it: the camera flies in until the node's outline frames the window,
  // its header fades as the camera passes it, and its internals, drawn inside it, grow into view
  // with the zoom. Selecting a group of traces frames it instead, with labels printed by its traces.
  // One loop drives all of it from the same `t`, so it moves as one scene.
  const stageRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  // The same, for the loop and the effects (which outlive a render).
  const current = useRef<View | null>(null);
  const frame = useRef(0);
  const snapshots = useZoomSnapshots(
    graphId,
    graph,
    window.innerWidth >= WIDE ? landscape : portrait,
    stageRef,
  );

  /**
   * Plans zooming into `id` (a node, or a group of traces) from the camera `from`, measuring its
   * `content` (the node's internals, or the group's notes) at its width. A group's plan doesn't
   * depend on it.
   */
  const plan = (id: string, from: Camera, content = contentRef.current) => {
    const stageElement = stageRef.current;
    if (!stageElement) return null;
    const layout = window.innerWidth >= WIDE ? landscape : portrait;
    // The stage is the window's clear area.
    const stage = measureStage(stageElement);
    if (content) content.style.minHeight = "";
    const group = graph.traceGroups.find((candidate) => candidate.id === id);
    if (group) {
      const crop = window.innerWidth >= WIDE ? 1 : NARROW_CROP;
      return planFrameZoom(layout, id, traceArea(graph, layout, group), stage, from, crop);
    }
    if (!content) return null;
    const width = contentWidth(stage);
    content.style.width = `${width}px`;
    // Its layout height unrounded (`offsetHeight` rounds, and a fraction of a px over makes it
    // scroll), from its drawn size (it may be scaled), up to the next whole px.
    const box = content.getBoundingClientRect();
    const height = box.width ? Math.ceil(box.height * (width / box.width)) : content.offsetHeight;
    return planZoom(layout, id, stage, height, from);
  };

  /** Runs `zoom`'s `t` from `from` to `to`, a frame at a time. */
  const run = (zoom: Zoom, from: number, to: number, done?: () => void) => {
    cancelAnimationFrame(frame.current);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : ZOOM_MS * Math.abs(to - from);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      // A plan re-measured on the way (see below) takes over from here.
      const { plan, parent } = current.current?.plan.id === zoom.plan.id ? current.current : zoom;
      current.current = { plan, parent, t: from + (to - from) * progress };
      setView(current.current);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else done?.();
    };
    tick(start);
  };

  /** Where `zoom` starts: the overview (none), or resting in the group of traces it's entered from. */
  const restOf = (zoom: Zoom): View | null => (zoom.parent ? { plan: zoom.parent, t: 1 } : null);
  /**
   * Zooms back out of `at`, retracing it from wherever it's got to, and on out of the group of traces
   * it was entered from unless that's `group`; then focus goes back to the node.
   */
  const zoomBack = (at: View, group: string | null) => {
    run(at, at.t, 0, () => {
      const rest = restOf(at);
      current.current = rest;
      setView(rest);
      if (rest && rest.plan.id !== group) {
        zoomBack(rest, group);
        return;
      }
      // In the interior only: the page's frosted glass draws a copy of the graph too.
      [...(regionRef.current?.querySelectorAll<SVGGElement>(`[data-node="${at.plan.id}"]`) ?? [])]
        .find((element) => element.getClientRects().length > 0)
        ?.focus({ preventScroll: true });
    });
  };
  /**
   * Plans zooming into `id`: from the view of `group` at rest (the group of traces it's entered
   * from), or else from wherever the camera is (the overview, or following a link, another node).
   */
  const zoomTo = (id: string, group: string | null, open: View | null): Zoom | null => {
    if (group) {
      // Following a link, the camera isn't resting there yet: it starts there.
      const from = open?.plan.id === group && !open.parent ? open.plan : plan(group, IDENTITY);
      const zoom = from && plan(id, from.to);
      return zoom ? { plan: zoom, parent: from } : null;
    }
    const zoom = plan(id, open ? zoomFrame(open.plan, ease(open.t)).camera : IDENTITY);
    return zoom ? { plan: zoom } : null;
  };

  useLayoutEffect(() => {
    const open = current.current;
    if (!selected) {
      // Closing retraces opening.
      if (open) zoomBack(open, null);
      return;
    }
    // Back out of a node to the group of traces it was entered from.
    if (open?.parent?.id === selected) {
      zoomBack(open, selected);
      return;
    }
    // Reselected while closing (or zoomed into by a gesture): carry on in from where it is.
    if (open?.plan.id === selected && (open.parent?.id ?? null) === parent) {
      run(open, open.t, 1);
      return;
    }
    const zoom = zoomTo(selected, parent, open);
    if (zoom) {
      // Usually ready from hovering it; if not, they're made now, while the zoom gets going.
      if (!zoom.parent) snapshots.prepare({ kind: "start", id: selected });
      snapshots.prepare({ kind: "target", id: selected });
      snapshots.prepare({ kind: "final", id: selected, camera: zoom.plan.to });
      run(zoom, 0, 1, () => interiorRef.current?.focus({ preventScroll: true }));
    }
  }, [selected, parent]);

  // It follows the stage, the screen and its content (e.g. once the fonts load). The stage can also
  // settle just after a zoom starts (opening the page on `?xray=<id>`, the window's clear area is
  // set after this measures it), so a zoom under way carries on with the new plan.
  useEffect(() => {
    const stageElement = stageRef.current;
    const content = contentRef.current;
    if (!selected || !stageElement || !content) return;
    const replan = () => {
      const open = current.current;
      if (open?.plan.id !== selected) return;
      // Entered from a group of traces, it starts where the group's view (re-planned too) rests.
      const group = open.parent && plan(open.parent.id, IDENTITY);
      const zoom = open.parent
        ? group && plan(selected, group.to)
        : plan(selected, open.t < 1 ? open.plan.from : IDENTITY);
      if (zoom) {
        current.current = { plan: zoom, parent: group ?? undefined, t: open.t };
        setView(current.current);
      }
    };
    const observer = new ResizeObserver(replan);
    observer.observe(stageElement);
    observer.observe(content);
    window.addEventListener("resize", replan);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", replan);
    };
  }, [selected, parent]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // At rest inside (e.g. opened on a `?xray=<id>` link), the snapshots for the way back out (to the
  // group of traces it was entered from: that view's).
  const restingIn = view?.t === 1 ? view : null;
  useEffect(() => {
    if (!SNAPSHOTS || !open || !restingIn) return;
    const { plan, parent } = restingIn;
    const timer = setTimeout(() => {
      if (parent) {
        snapshots.prepare({ kind: "target", id: parent.id });
        snapshots.prepare({ kind: "final", id: parent.id, camera: parent.to });
      } else {
        snapshots.prepare({ kind: "start", id: plan.id });
      }
      snapshots.prepare({ kind: "target", id: plan.id });
      snapshots.prepare({ kind: "final", id: plan.id, camera: plan.to });
    }, 300);
    return () => clearTimeout(timer);
  }, [open, restingIn]);

  // Resting in a group of traces' view: its nodes can be zoomed into from there.
  const groupAtRest =
    view?.t === 1 && !view.parent && view.plan.id === selected && isGroup(selected)
      ? selected
      : null;
  const enterable = groupAtRest ? enterableFrom(graph, groupAtRest) : null;

  // Hovering (or focusing) a node or a group of traces makes the snapshots for zooming into it, once
  // the pointer has stayed on it for a moment: the target's, and the final view's, from the zoom
  // planned as it would be from here (a node's measured with a hidden copy of its internals).
  const [measuring, setMeasuring] = useState<string | null>(null);
  const measureRef = useRef<HTMLElement>(null);
  const measureContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!measuring) return;
    const zoom = plan(measuring, IDENTITY, measureContentRef.current);
    if (zoom) snapshots.prepare({ kind: "final", id: measuring, camera: zoom.to });
  }, [measuring]);
  const lingering = useRef<{ id: string | null; timer?: ReturnType<typeof setTimeout> }>({ id: null });
  const prepareFor = (element: EventTarget | null) => {
    if (!SNAPSHOTS) return;
    const target = element instanceof Element ? element : null;
    const hovered =
      target?.closest("[data-node]")?.getAttribute("data-node") ??
      target?.closest("[data-group]")?.getAttribute("data-group") ??
      stageRef.current?.querySelector("[data-hovered]")?.getAttribute("data-group") ??
      null;
    // In a group's view, only its nodes (zoomed into from there, so their zoom starts there).
    const id = !enterable || (hovered && enterable.includes(hovered)) ? hovered : null;
    if (id === lingering.current.id) return;
    clearTimeout(lingering.current.timer);
    lingering.current = {
      id,
      timer: id
        ? setTimeout(() => {
            if (!enterable) snapshots.prepare({ kind: "start", id });
            snapshots.prepare({ kind: "target", id });
            setMeasuring(id);
          }, 120)
        : undefined,
    };
  };
  useEffect(() => () => clearTimeout(lingering.current.timer), []);

  // Zooming by gesture: scrolling, a trackpad pinch (ctrl+wheel) or a two-finger pinch scrubs the
  // camera. In the overview it zooms into the node or group of traces under the pointer (or between
  // the fingers), and in a group's view into one of its nodes; inside one, it zooms back out
  // (scrolling down once the content is at its end). Past a point it carries on by itself; let go
  // before that and it settles back. Zooming out of the overview leaves the x-ray.
  useEffect(() => {
    const region = regionRef.current;
    if (!open || !region) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let pinch: {
      distance: number;
      x: number;
      y: number;
      eased: number | null;
      spread: number;
    } | null = null;
    // This gesture has moved the camera; it has gone far enough to carry on by itself.
    let scrubbing = false;
    let handedOver = false;
    // How far this gesture has zoomed out of the overview, and until when it can't yet (see below).
    let outOfOverview = 0;
    let restsAfter = 0;

    /**
     * The node or group of traces at a point: as hovering picks it (near a trace picks its group). In
     * the view of a group (`from`), only its nodes.
     */
    const targetAt = (element: Element | null, x: number, y: number, from?: ZoomPlan) => {
      const svg = [...(stageRef.current?.firstElementChild?.querySelectorAll("svg") ?? [])].find(
        (candidate) => candidate.getClientRects().length > 0,
      );
      const toLayout = svg?.getScreenCTM()?.inverse();
      const nearest = () => {
        if (!toLayout) return null;
        const layout = window.innerWidth >= WIDE ? landscape : portrait;
        const point = new DOMPoint(x, y).matrixTransform(toLayout);
        return nearestTraceGroup(graph, layout, point, NEAR_TRACE)?.id ?? null;
      };
      const id =
        element?.closest("[data-node]")?.getAttribute("data-node") ??
        element?.closest("[data-group]")?.getAttribute("data-group") ??
        nearest();
      if (!id || !isZoomTarget(graph, id)) return null;
      return !from || enterableFrom(graph, from.id).includes(id) ? id : null;
    };
    /**
     * A zoom into `id`, not started yet: from the overview, or from the view of a group of traces
     * (`from`). A node's measured now if it isn't yet.
     */
    const zoomInto = (id: string, from?: ZoomPlan): View | null => {
      const group = isGroup(id);
      if (!group) flushSync(() => setMeasuring(id));
      const zoom = plan(id, from?.to ?? IDENTITY, group ? null : measureContentRef.current);
      if (!zoom) return null;
      if (!from) snapshots.prepare({ kind: "start", id });
      snapshots.prepare({ kind: "target", id });
      snapshots.prepare({ kind: "final", id, camera: zoom.to });
      return { plan: zoom, parent: from, t: 0 };
    };
    /**
     * The zoom a gesture moves, if it can: out of the selected node or group (and back in while at
     * it); or, from where the camera rests (the overview, or a group's view), into the target at the
     * pointer (and back out while at it), or a zoom on its way back out there, caught.
     */
    const take = (zoomingIn: boolean, element: Element | null, x: number, y: number) => {
      const at = current.current;
      if (handedOver) return null;
      if (selected && at?.plan.id === selected) {
        if (!zoomingIn || scrubbing) return at;
        // In a group's view at rest, zooming in goes into one of its nodes.
        if (at.t < 1 || at.parent || !isGroup(selected)) return null;
        const id = targetAt(element, x, y, at.plan);
        return id ? zoomInto(id, at.plan) : null;
      }
      if (selected) return at?.parent?.id === selected && (zoomingIn || scrubbing) ? at : null;
      if (at) return zoomingIn || scrubbing ? at : null;
      const id = zoomingIn ? targetAt(element, x, y) : null;
      return id ? zoomInto(id) : null;
    };
    const scrubTo = (at: View, eased: number) => {
      cancelAnimationFrame(frame.current);
      scrubbing = true;
      const clamped = Math.min(1, Math.max(0, eased));
      current.current = { ...at, t: easeInverse(clamped) };
      // Into something from where the camera rests, or out of the selection.
      const deeper = at.plan.id !== selected;
      if (deeper ? clamped > ENTER_ABOVE : clamped < LEAVE_BELOW) {
        // Far enough: the zoom finishes from here (see the effect on `selected`).
        handedOver = true;
        const { onSelect } = latest.current;
        if (deeper && at.parent) onSelect(at.plan.id, at.parent.id);
        else if (deeper) onSelect(at.plan.id);
        else if (at.parent) onSelect(at.parent.id);
        else onSelect(null);
      } else if (deeper && clamped === 0) {
        // All the way back to where it rests: going on doesn't leave the x-ray without a pause.
        const rest = restOf(at);
        current.current = rest;
        scrubbing = false;
        restsAfter = performance.now() + SETTLE_MS;
        setView(rest);
      } else {
        setView(current.current);
      }
    };
    /**
     * Zooming out of the overview by `amount` (as far as it would move a zoom): as far as leaving a
     * node takes leaves the x-ray. Only a gesture begun in the overview at rest counts, not one running
     * on from zooming out of a node (a trackpad's momentum): that has to pause first.
     */
    const zoomOutOfOverview = (amount: number, time: number) => {
      if (handedOver) return false;
      if (current.current || time < restsAfter) {
        restsAfter = time + SETTLE_MS;
        return false;
      }
      outOfOverview += amount;
      if (outOfOverview >= 1 - LEAVE_BELOW) {
        handedOver = true;
        latest.current.onClose();
      }
      return true;
    };
    const settleBack = () => {
      const at = current.current;
      scrubbing = false;
      outOfOverview = 0;
      if (handedOver || !at) return;
      if (at.plan.id === selected) {
        if (at.t < 1) run(at, at.t, 1);
      } else if (at.t > 0) {
        run(at, at.t, 0, () => {
          const rest = restOf(at);
          current.current = rest;
          setView(rest);
        });
      }
    };

    const onWheel = (event: WheelEvent) => {
      const trackpadPinch = event.ctrlKey;
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      if (delta === 0) return;
      const zoomingIn = delta < 0;
      if (!trackpadPinch) {
        // Inside, long internals scroll to their end before zooming out.
        const at = current.current;
        const interior = interiorRef.current;
        const canScroll =
          at?.t === 1 &&
          interior &&
          interior.scrollTop + interior.clientHeight < interior.scrollHeight - 1;
        if (selected && !zoomingIn && canScroll) return;
      }
      const amount = delta / (trackpadPinch ? TRACKPAD_PINCH_PX : SCROLL_PX);
      const at = take(zoomingIn, event.target as Element, event.clientX, event.clientY);
      if (at) scrubTo(at, ease(at.t) - amount);
      else if (selected || zoomingIn || !zoomOutOfOverview(amount, event.timeStamp)) return;
      // Also stops the browser's own pinch zoom.
      event.preventDefault();
      clearTimeout(settle);
      settle = setTimeout(settleBack, SETTLE_MS);
    };

    const fingers = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const [a, b] = [event.touches[0], event.touches[1]];
      pinch = {
        distance: fingers(event.touches),
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
        eased: null,
        spread: 0,
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      const { x, y } = pinch;
      // Fingers apart zoom in (the log is positive); together, out.
      const spread = Math.log2(fingers(event.touches) / pinch.distance);
      const step = (spread - pinch.spread) * TOUCH_PINCH_GAIN;
      pinch.spread = spread;
      const at = take(spread > 0, document.elementFromPoint(x, y), x, y);
      if (at) {
        pinch.eased ??= ease(at.t);
        scrubTo(at, pinch.eased + spread * TOUCH_PINCH_GAIN);
      } else if (selected || step >= 0 || !zoomOutOfOverview(-step, event.timeStamp)) {
        return;
      }
      event.preventDefault();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (pinch && event.touches.length < 2) {
        pinch = null;
        settleBack();
      }
    };

    region.addEventListener("wheel", onWheel, { passive: false });
    region.addEventListener("touchstart", onTouchStart);
    region.addEventListener("touchmove", onTouchMove, { passive: false });
    region.addEventListener("touchend", onTouchEnd);
    region.addEventListener("touchcancel", onTouchEnd);
    return () => {
      clearTimeout(settle);
      // Closed while zooming into something: back out, so it opens where it was resting.
      const at = current.current;
      if (scrubbing && !handedOver && at && at.plan.id !== selected) settleBack();
      region.removeEventListener("wheel", onWheel);
      region.removeEventListener("touchstart", onTouchStart);
      region.removeEventListener("touchmove", onTouchMove);
      region.removeEventListener("touchend", onTouchEnd);
      region.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [open, selected, parent, graphId]);

  // What's zoomed into (or out of): a node (`into`), a group of traces (`framed`), or a node entered
  // from a group (both); and this frame of it.
  const into =
    selected && !isGroup(selected)
      ? selected
      : view && !isGroup(view.plan.id)
        ? view.plan.id
        : null;
  const framed =
    (isGroup(selected) ? selected : null) ??
    parent ??
    view?.parent?.id ??
    (view && isGroup(view.plan.id) ? view.plan.id : null);
  const shown = into ?? framed;
  const zoom = view && zoomFrame(view.plan, ease(view.t));
  const camera = zoom?.camera ?? IDENTITY;
  const dim = view ? dimAt(view.t) : 1;
  const zoomedInto = view && into ? { id: into, headerOpacity: 1 - dim } : null;
  const graphProps = {
    graph,
    selected: into,
    selectedGroup: into ? null : framed,
    // Into a node from a group's view, the group's lighting fades into the node's.
    from: into && framed ? { selectedGroup: framed } : null,
    dim,
    zoomedInto,
    // In the overview, anything; in a group's view at rest, its nodes.
    onSelect: !shown
      ? onSelect
      : groupAtRest
        ? (id: string) => onSelect(id, groupAtRest)
        : undefined,
    targets: enterable ?? undefined,
  };
  const frameProps: ZoomFrameProps = {
    ref: interiorRef,
    contentRef,
    rect: zoom
      ? {
          left: zoom.content.x,
          top: zoom.content.y,
          width: zoom.content.width,
          height: zoom.content.height,
        }
      : null,
    // Laid out unscaled; `scale` draws it at its size in the scene.
    width: view ? view.plan.content.width / view.plan.contentZoom : 0,
    height: view ? view.plan.content.height / view.plan.contentZoom : 0,
    scale: zoom?.contentScale ?? 1,
    // It comes into focus as the camera reaches it.
    opacity: view ? ramp(view.t, 0.45, 0.85) : 0,
    // Only once inside, and only if the internals don't fit.
    scrollable: view?.t === 1 && view.plan.overflows,
  };

  // Which zoom's snapshots the live graph is hidden behind (see below): its target's id, after the
  // group of traces it was entered from, if any (`<group>/<node>`).
  const [liveHidden, setLiveHidden] = useState<string | null>(null);
  const keyOf = (at: View) => (at.parent ? `${at.parent.id}/${at.plan.id}` : at.plan.id);
  // While the camera moves (Firefox, once the snapshots are ready), it carries snapshots of the zoom
  // `key` instead of the live graph: how the zoom starts (from the overview; or from a group's view,
  // that view at rest, sharp once it's ready), with the target's (the rest dimmed, the header gone)
  // fading in over it as the header would fade, then the final view's, sharp, towards the end. Back
  // where it started, how it started. Each covers the ones under it, so only those still showing
  // through are drawn.
  const layersAt = (key: string | null, at: View | null): SceneLayer[] | null => {
    if (!key) return null;
    const [id, from] = key.split("/").reverse();
    const fromCamera = at?.parent?.to ?? (from && at?.plan.id === from ? at.plan.to : undefined);
    const start = from
      ? ((fromCamera && snapshots.get({ kind: "final", id: from, camera: fromCamera })) ??
        snapshots.get({ kind: "target", id: from }))
      : snapshots.get({ kind: "start", id });
    const target = snapshots.get({ kind: "target", id });
    if (!start || !target) return null;
    if (at?.plan.id !== id) return [{ kind: "start", snapshot: start, opacity: 1 }];
    const final = snapshots.get({ kind: "final", id, camera: at.plan.to });
    const layers: SceneLayer[] = [
      { kind: "start", snapshot: start, opacity: 1 },
      { kind: "target", snapshot: target, opacity: dimAt(at.t) },
    ];
    if (final) layers.push({ kind: "final", snapshot: final, opacity: ramp(at.t, 0.55, 0.85) });
    const covering = Math.max(...layers.map((layer, i) => (layer.opacity === 1 ? i : 0)));
    return layers.slice(covering).filter((layer) => layer.opacity > 0);
  };
  // Inside a node, it keeps them once the camera has come to rest (nothing in the graph is
  // interactive there), as long as the final view's is there to rest on: the overview and a group's
  // view (its nodes zoom in) need the live graph. A zoom that started on the live graph (e.g. opened
  // on a `?xray=<id>` link) stays on it at rest.
  const restsOnSnapshots = (at: View) =>
    at.t < 1 ||
    (!isGroup(at.plan.id) &&
      liveHidden === keyOf(at) &&
      snapshots.get({ kind: "final", id: at.plan.id, camera: at.plan.to }) !== undefined);
  const carried =
    view && view.t > 0 && restsOnSnapshots(view) && layersAt(keyOf(view), view)
      ? keyOf(view)
      : null;
  // The live graph stays hidden one frame longer than the snapshots are needed, so it takes on its
  // resting state (selected, dimmed, or not) without a transition before it shows again.
  useLayoutEffect(() => {
    if (carried) {
      setLiveHidden(carried);
      return;
    }
    if (!liveHidden) return;
    const next = requestAnimationFrame(() => setLiveHidden(null));
    return () => cancelAnimationFrame(next);
  }, [carried, liveHidden]);
  const layers = layersAt(carried ?? liveHidden, view);

  // While zoomed in, clicking anywhere around (other nodes and traces too) zooms back out; in a
  // group's view, except on its nodes (they zoom in).
  const onStageClick = (event: ReactMouseEvent) => {
    const node = (event.target as Element).closest("[data-node]")?.getAttribute("data-node");
    if (node && enterable?.includes(node)) return;
    if (shown) zoomOut();
  };

  return (
    <>
      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label="Infrastructure"
        inert={!open}
        data-open={open || undefined}
        // Two-finger pinches zoom the board (into a node or group, and out of it), not the page.
        className="xray-interior fixed inset-0 z-20 touch-pan-y overflow-hidden bg-[oklch(0.13_0.045_292)] outline-none"
      >
        <div className="xray-content flex h-dvh items-center justify-center">
          <div
            ref={stageRef}
            onClick={onStageClick}
            onPointerMove={(event) => (!shown || groupAtRest) && prepareFor(event.target)}
            onFocus={(event) => (!shown || groupAtRest) && prepareFor(event.target)}
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
            }}
            className="xray-camera relative size-full"
          >
            <div
              key={graphId}
              className={cn(
                "size-full",
                leaving && "animate-in fade-in duration-500 ease-in-out",
                liveHidden && "invisible [&_*]:transition-none",
              )}
            >
              <InfraGraph
                layout={landscape}
                {...graphProps}
                grid
                className="hidden size-full lg:block"
              />
              <InfraGraph
                layout={portrait}
                {...graphProps}
                grid
                className="size-full lg:hidden"
              />
            </div>
            {leaving && (
              <div
                key={leaving}
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-out fade-out fill-mode-forwards duration-500 ease-in-out"
              >
                <InfraGraph
                  graph={graphs[leaving]}
                  layout={graphs[leaving].layouts.landscape}
                  decorative
                  grid
                  className="hidden size-full lg:block"
                />
                <InfraGraph
                  graph={graphs[leaving]}
                  layout={graphs[leaving].layouts.portrait}
                  decorative
                  grid
                  className="size-full lg:hidden"
                />
              </div>
            )}
            {layers?.map(({ kind, snapshot, opacity }) => (
              <SnapshotLayer key={kind} snapshot={snapshot} opacity={opacity} />
            ))}
            {snapshots.hidden}
          </div>
          {/* Only in the overview: inside a node or a group, the way out comes first. */}
          <ViewSwitch
            value={graphId}
            onChange={onGraphChange}
            inert={!!shown}
            className={cn("transition-opacity duration-300", shown && "opacity-0")}
          />
        </div>
        {framed && (
          <TraceLabels
            key={framed}
            // Into a node from the group's view, the node's internals are what's zoomed into.
            ref={into ? undefined : interiorRef}
            contentRef={into ? undefined : contentRef}
            graph={graph}
            groupId={framed}
            layout={window.innerWidth >= WIDE ? landscape : portrait}
            plan={view?.parent ?? view?.plan ?? null}
            camera={camera}
            // Only once the camera has arrived; into one of its nodes, they go as the zoom gets going.
            opacity={
              !view
                ? 0
                : view.parent
                  ? 1 - ramp(view.t, 0, 0.3)
                  : view.plan.id === framed
                    ? ramp(view.t, 0.85, 1)
                    : 0
            }
          />
        )}
        {into && (
          <NodeInterior key={into} {...frameProps} graph={graph} nodeId={into} />
        )}
        {/* In the overview or a group's view: the internals of the node being hovered, hidden,
            measured to plan its zoom ahead (see `measuring`). */}
        {(!shown || groupAtRest) && measuring && graph.details[measuring] && (
          <NodeInterior
            key={`measure-${measuring}`}
            ref={measureRef}
            contentRef={measureContentRef}
            rect={null}
            width={0}
            height={0}
            scale={1}
            opacity={0}
            scrollable={false}
            graph={graph}
            nodeId={measuring}
          />
        )}
      </section>
      {open && (
        <>
          {/* Phones: a visible Close. Wide screens: only for keyboard users (shown on focus), since
              Escape and clicking the edge close it there. */}
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            className={cn(
              "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 gap-2 animate-in fade-in duration-500 motion-reduce:animate-none lg:not-focus-visible:sr-only lg:top-[calc(var(--spacing-header)+1.5rem)] lg:right-8 lg:bottom-auto lg:left-auto lg:translate-x-0",
              // Phones: inside a node, pinching out leaves it first; Close returns with the overview.
              selected && "max-lg:hidden",
            )}
          >
            <XIcon aria-hidden />
            Close
          </Button>
          {/* Wide screens: clicking the faded edge band steps back. Invisible, outside the graph (but
              zoomed in, traces run under it). */}
          <div aria-hidden className="hidden lg:block">
            <div data-edge-zone onClick={stepBack} className="fixed inset-y-0 left-0 z-40 w-[7vw]" />
            <div data-edge-zone onClick={stepBack} className="fixed inset-y-0 right-0 z-40 w-[7vw]" />
            <div data-edge-zone onClick={stepBack} className="fixed inset-x-0 bottom-0 z-40 h-[8vh]" />
          </div>
          {/* The way back, with a hint: wide screens always; phones while zoomed in (in the overview
              they have Close instead). */}
          <div
            className={cn(
              "fixed inset-x-0 bottom-4 z-50 flex-col items-center gap-8 animate-in fade-in duration-700 motion-reduce:animate-none",
              selected ? "flex" : "hidden lg:flex",
            )}
          >
            {/* A bare arrow with a long tail, no button shape around it. A soft fade of the interior's
                colour behind it (no visible edge) keeps traces running behind from merging with it. */}
            <button
              type="button"
              onClick={stepBack}
              aria-label={selected ? "Zoom out" : "Exit the x-ray"}
              className="rounded-md bg-[radial-gradient(closest-side,oklch(0.13_0.045_292),oklch(0.13_0.045_292/0.8)_50%,transparent)] px-6 py-2 text-neutral-400 transition-colors outline-none hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                aria-hidden
                viewBox="0 0 28 40"
                className="h-10 w-7 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
              >
                <path d="M14 2 V37 M5 28 L14 37 L23 28" />
              </svg>
            </button>
            <p className="pointer-events-none text-center font-mono text-xs text-neutral-400">
              {selected ? (
                <>
                  <span className="lg:hidden">pinch to zoom out</span>
                  <span className="hidden lg:inline">
                    scroll out or press <Kbd>esc</Kbd> to zoom out
                  </span>
                </>
              ) : (
                <>
                  scroll or pinch to zoom in or out · press <Kbd>esc</Kbd> to exit
                </>
              )}
            </p>
          </div>
        </>
      )}
    </>
  );
};
