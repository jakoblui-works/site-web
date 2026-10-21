import type { Rect } from "./infra-graph";

/**
 * The x-ray's stage (the camera's element, which fills its parent's content box), in its parent's
 * px, without the camera's transform and unrounded: `offsetTop` and the like round to whole px, and
 * zooming in scales that up with the camera, a few px off once inside a node.
 */
export const measureStage = (stage: HTMLElement): Rect => {
  const parent = stage.parentElement;
  if (!parent) {
    return { x: stage.offsetLeft, y: stage.offsetTop, width: stage.offsetWidth, height: stage.offsetHeight };
  }
  const box = parent.getBoundingClientRect();
  const style = getComputedStyle(parent);
  const [top, right, bottom, left] = [
    style.paddingTop,
    style.paddingRight,
    style.paddingBottom,
    style.paddingLeft,
  ].map(parseFloat);
  return { x: left, y: top, width: box.width - left - right, height: box.height - top - bottom };
};
