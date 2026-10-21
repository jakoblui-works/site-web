import { XIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  SNAPSHOTS,
  SnapshotLayer,
  useZoomSnapshots,
  type Snapshot,
} from "@/hooks/use-zoom-snapshots";
import { graphs, type GraphId } from "@/lib/graphs";
import { NARROW_CROP, traceArea } from "@/lib/trace-groups";
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
 * Leaving a node by zooming out: how far a gesture moves the (eased) zoom per px of scrolling, of
 * trackpad pinching (ctrl+wheel) and per doubling of the distance between two fingers; and where it
 * stops scrubbing and carries on out by itself.
 */
const SCROLL_PX = 600;
const TRACKPAD_PINCH_PX = 200;
const TOUCH_PINCH_GAIN = 0.6;
const LEAVE_BELOW = 0.75;
/**
 * How long scrolling has to pause (ms) before a zoom-out that didn't get that far settles back in:
 * longer than the gap between a mouse wheel's notches, so slow scrolling doesn't pull back in between.
 */
const SETTLE_MS = 400;

/** How far the camera is into a node: 0 the overview, 1 inside it. */
type View = { plan: ZoomPlan; t: number };

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
  /** Select a node or group of traces, or go back to the overview with `null`. */
  onSelect: (id: string | null) => void;
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
  onSelect,
  onClose,
}: XrayProps) => {
  const graph = graphs[graphId];
  const { landscape, portrait } = graph.layouts;

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
  const latest = useRef({ selected, onSelect, onClose });
  useEffect(() => {
    latest.current = { selected, onSelect, onClose };
  });
  // Leaving steps back one level: from a node or group of traces to the overview, then out of the
  // x-ray (Escape, the arrow, and on wide screens the faded edge band).
  const stepBack = () => {
    const { selected, onSelect, onClose } = latest.current;
    if (selected) onSelect(null);
    else onClose();
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
    // The stage is the window's clear area; offsets ignore the camera's own transform.
    const stage = {
      x: stageElement.offsetLeft,
      y: stageElement.offsetTop,
      width: stageElement.offsetWidth,
      height: stageElement.offsetHeight,
    };
    if (content) content.style.minHeight = "";
    const group = graph.traceGroups.find((candidate) => candidate.id === id);
    if (group) {
      const crop = window.innerWidth >= WIDE ? 1 : NARROW_CROP;
      return planFrameZoom(layout, id, traceArea(graph, layout, group), stage, from, crop);
    }
    if (!content) return null;
    content.style.width = `${contentWidth(stage)}px`;
    return planZoom(layout, id, stage, content.offsetHeight, from);
  };

  /** Runs `t` from `from` to `to`, a frame at a time. */
  const run = (zoom: ZoomPlan, from: number, to: number, done?: () => void) => {
    cancelAnimationFrame(frame.current);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : ZOOM_MS * Math.abs(to - from);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      // A plan re-measured on the way (see below) takes over from here.
      const latestPlan = current.current?.plan.id === zoom.id ? current.current.plan : zoom;
      current.current = { plan: latestPlan, t: from + (to - from) * progress };
      setView(current.current);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else done?.();
    };
    tick(start);
  };

  useLayoutEffect(() => {
    const open = current.current;
    if (!selected) {
      if (!open) return;
      // Closing retraces opening, from wherever it's got to; then focus goes back to the node.
      const id = open.plan.id;
      run(open.plan, open.t, 0, () => {
        current.current = null;
        setView(null);
        // In the interior only: the page's frosted glass draws a copy of the graph too.
        [...(regionRef.current?.querySelectorAll<SVGGElement>(`[data-node="${id}"]`) ?? [])]
          .find((element) => element.getClientRects().length > 0)
          ?.focus({ preventScroll: true });
      });
      return;
    }
    // Reselected while closing: open again from where it is.
    if (open?.plan.id === selected) {
      run(open.plan, open.t, 1);
      return;
    }
    // From the overview, or (following a link) from another open node's camera.
    const zoom = plan(selected, open ? zoomFrame(open.plan, ease(open.t)).camera : IDENTITY);
    if (zoom) {
      // Usually ready from hovering it; if not, they're made now, while the zoom gets going.
      snapshots.prepare({ kind: "start", id: selected });
      snapshots.prepare({ kind: "target", id: selected });
      snapshots.prepare({ kind: "final", id: selected, camera: zoom.to });
      run(zoom, 0, 1, () => interiorRef.current?.focus({ preventScroll: true }));
    }
  }, [selected]);

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
      const zoom = plan(selected, open.t < 1 ? open.plan.from : IDENTITY);
      if (zoom) {
        current.current = { plan: zoom, t: open.t };
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
  }, [selected]);

  // Leaving by zooming out: scrolling down (once the content is at its end), a trackpad pinch or a
  // two-finger pinch scrubs the camera back out. Past a point it carries on out by itself; let go
  // before that and it settles back in.
  useEffect(() => {
    const region = regionRef.current;
    if (!selected || !region) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let pinch: { distance: number; eased: number } | null = null;
    let leaving = false;

    const inside = () => {
      const open = current.current;
      return open?.plan.id === selected && !leaving ? open : null;
    };
    const scrubTo = (eased: number) => {
      const open = inside();
      if (!open) return;
      cancelAnimationFrame(frame.current);
      const clamped = Math.min(1, Math.max(0, eased));
      current.current = { plan: open.plan, t: easeInverse(clamped) };
      if (clamped < LEAVE_BELOW) {
        // Far enough: zooming out finishes from here (see the effect above).
        leaving = true;
        latest.current.onSelect(null);
      } else {
        setView(current.current);
      }
    };
    const settleBack = () => {
      const open = inside();
      if (open && open.t < 1) run(open.plan, open.t, 1);
    };

    const onWheel = (event: WheelEvent) => {
      const open = inside();
      if (!open) return;
      const trackpadPinch = event.ctrlKey;
      if (!trackpadPinch) {
        // Only scrolling down zooms out, and long internals scroll to their end first.
        const interior = interiorRef.current;
        const canScroll =
          open.t === 1 &&
          interior &&
          interior.scrollTop + interior.clientHeight < interior.scrollHeight - 1;
        if (event.deltaY <= 0 || canScroll) return;
      }
      // Also stops the browser's own pinch zoom.
      event.preventDefault();
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      scrubTo(ease(open.t) - delta / (trackpadPinch ? TRACKPAD_PINCH_PX : SCROLL_PX));
      clearTimeout(settle);
      settle = setTimeout(settleBack, SETTLE_MS);
    };

    const fingers = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    const onTouchStart = (event: TouchEvent) => {
      const open = inside();
      if (open && event.touches.length === 2) {
        pinch = { distance: fingers(event.touches), eased: ease(open.t) };
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      // Fingers together zoom out (the log is negative); apart, back in.
      scrubTo(pinch.eased + Math.log2(fingers(event.touches) / pinch.distance) * TOUCH_PINCH_GAIN);
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
      region.removeEventListener("wheel", onWheel);
      region.removeEventListener("touchstart", onTouchStart);
      region.removeEventListener("touchmove", onTouchMove);
      region.removeEventListener("touchend", onTouchEnd);
      region.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [selected]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // At rest inside (e.g. opened on a `?xray=<id>` link), the snapshots for the way back out.
  const restingIn = view?.t === 1 ? view.plan : null;
  useEffect(() => {
    if (!SNAPSHOTS || !open || !restingIn) return;
    const timer = setTimeout(() => {
      snapshots.prepare({ kind: "start", id: restingIn.id });
      snapshots.prepare({ kind: "target", id: restingIn.id });
      snapshots.prepare({ kind: "final", id: restingIn.id, camera: restingIn.to });
    }, 300);
    return () => clearTimeout(timer);
  }, [open, restingIn]);

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
    const id =
      target?.closest("[data-node]")?.getAttribute("data-node") ??
      target?.closest("[data-group]")?.getAttribute("data-group") ??
      stageRef.current?.querySelector("[data-hovered]")?.getAttribute("data-group") ??
      null;
    if (id === lingering.current.id) return;
    clearTimeout(lingering.current.timer);
    lingering.current = {
      id,
      timer: id
        ? setTimeout(() => {
            snapshots.prepare({ kind: "start", id });
            snapshots.prepare({ kind: "target", id });
            setMeasuring(id);
          }, 120)
        : undefined,
    };
  };
  useEffect(() => () => clearTimeout(lingering.current.timer), []);

  // What's zoomed into (or out of): a node, or a group of traces; and this frame of it.
  const shown = selected ?? view?.plan.id ?? null;
  const shownGroup = graph.traceGroups.some((group) => group.id === shown);
  const zoom = view && zoomFrame(view.plan, ease(view.t));
  const camera = zoom?.camera ?? IDENTITY;
  const zoomedInto =
    view && !shownGroup
      ? { id: view.plan.id, headerOpacity: 1 - ramp(view.t, 0.15, 0.5) }
      : null;
  const graphProps = {
    graph,
    selected: shownGroup ? null : shown,
    selectedGroup: shownGroup ? shown : null,
    zoomedInto,
    onSelect: shown ? undefined : onSelect,
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
    scrollable: view?.t === 1,
  };

  // Which target's snapshots the live graph is hidden behind (see below).
  const [liveHidden, setLiveHidden] = useState<string | null>(null);
  // While the camera moves (Firefox, once the snapshots are ready), it carries snapshots of `id`
  // instead of the live graph: how the zoom starts, with the target's (the rest dimmed, the header
  // gone) fading in over it as the header would fade, then the final view's, sharp, towards the end.
  // Back at the overview, how it started. Each covers the ones under it, so only those still showing
  // through are drawn.
  const layersAt = (id: string | null, at: View | null): SceneLayer[] | null => {
    const start = id && snapshots.get({ kind: "start", id });
    const target = id && snapshots.get({ kind: "target", id });
    if (!id || !start || !target) return null;
    if (!at) return [{ kind: "start", snapshot: start, opacity: 1 }];
    const final = snapshots.get({ kind: "final", id, camera: at.plan.to });
    const layers: SceneLayer[] = [
      { kind: "start", snapshot: start, opacity: 1 },
      { kind: "target", snapshot: target, opacity: ramp(at.t, 0.15, 0.5) },
    ];
    if (final) layers.push({ kind: "final", snapshot: final, opacity: ramp(at.t, 0.55, 0.85) });
    const covering = Math.max(...layers.map((layer, i) => (layer.opacity === 1 ? i : 0)));
    return layers.slice(covering).filter((layer) => layer.opacity > 0);
  };
  // Inside, it keeps them once the camera has come to rest (nothing in the graph is interactive
  // there), as long as the final view's is there to rest on: only the overview needs the live graph.
  // A zoom that started on the live graph (e.g. opened on a `?xray=<id>` link) stays on it at rest.
  const restsOnSnapshots = (at: View) =>
    at.t < 1 ||
    (liveHidden === at.plan.id &&
      snapshots.get({ kind: "final", id: at.plan.id, camera: at.plan.to }) !== undefined);
  const carriedId =
    view && view.t > 0 && restsOnSnapshots(view) && layersAt(view.plan.id, view)
      ? view.plan.id
      : null;
  // The live graph stays hidden one frame longer than the snapshots are needed, so it takes on its
  // resting state (selected, dimmed, or not) without a transition before it shows again.
  useLayoutEffect(() => {
    if (carriedId) {
      setLiveHidden(carriedId);
      return;
    }
    if (!liveHidden) return;
    const next = requestAnimationFrame(() => setLiveHidden(null));
    return () => cancelAnimationFrame(next);
  }, [carriedId, liveHidden]);
  const layers = layersAt(carriedId ?? liveHidden, view);

  // While zoomed in, clicking anywhere around (other nodes and traces too) zooms back out.
  const onStageClick = () => {
    if (shown) onSelect(null);
  };

  return (
    <>
      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label="Infrastructure"
        inert={!open}
        data-open={open || undefined}
        className={cn(
          "xray-interior fixed inset-0 z-20 overflow-hidden bg-[oklch(0.13_0.045_292)] outline-none",
          // Inside a node, two-finger pinches zoom out of it rather than zooming the page.
          shown && "touch-pan-y",
        )}
      >
        <div className="xray-content flex h-dvh items-center justify-center">
          <div
            ref={stageRef}
            onClick={onStageClick}
            onPointerMove={(event) => !shown && prepareFor(event.target)}
            onFocus={(event) => !shown && prepareFor(event.target)}
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
        {shown &&
          (shownGroup ? (
            <TraceLabels
              key={shown}
              ref={interiorRef}
              contentRef={contentRef}
              graph={graph}
              groupId={shown}
              layout={window.innerWidth >= WIDE ? landscape : portrait}
              plan={view?.plan ?? null}
              camera={camera}
              // Only once the camera has arrived.
              opacity={view ? ramp(view.t, 0.85, 1) : 0}
            />
          ) : (
            <NodeInterior
              key={shown}
              {...frameProps}
              graph={graph}
              nodeId={shown}
            />
          ))}
        {/* In the overview: the internals of the node being hovered, hidden, measured to plan its
            zoom ahead (see `measuring`). */}
        {!shown && measuring && graph.details[measuring] && (
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
                  press <Kbd>esc</Kbd> to exit
                </>
              )}
            </p>
          </div>
        </>
      )}
    </>
  );
};
