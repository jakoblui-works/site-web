/** Drawing a rendered SVG as an image: for the frosted glass, and for the x-ray's zoom snapshots. */

import type { Rect } from "./infra-graph";

type Size = { width: number; height: number };

/** What an SVG drawn as an image keeps of each element's styling (it can't see the page's CSS). */
const PAINT = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linejoin",
  "stroke-linecap",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/**
 * A standalone copy of a rendered SVG, its computed styles written inline, as a data URL, drawn at
 * `size`. `viewBox` crops it to a region (viewBox units, stretched to `size`); `css` is added to it
 * (an SVG drawn as an image can't load the page's fonts, so they have to come with it).
 */
export const svgToImageUrl = (
  svg: SVGSVGElement,
  size: Size,
  { viewBox, css }: { viewBox?: Rect; css?: string } = {},
) => {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  from.forEach((element, i) => {
    const style = getComputedStyle(element);
    const target = to[i] as SVGElement;
    target.removeAttribute("class");
    target.setAttribute(
      "style",
      PAINT.map((property) => `${property}:${style.getPropertyValue(property)}`).join(";"),
    );
  });
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(size.width));
  copy.setAttribute("height", String(size.height));
  if (viewBox) {
    copy.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    copy.setAttribute("preserveAspectRatio", "none");
  }
  if (css) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = css;
    copy.prepend(style);
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copy.outerHTML)}`;
};

/** Whether a `unicode-range` covers Latin letters (Fontsource splits each family by script). */
const coversLatin = (range: string) =>
  range.split(",").some((part) => {
    const [from, to = from] = part.trim().replace(/^U\+/i, "").split("-");
    const a = parseInt(from.replaceAll("?", "0"), 16);
    const b = parseInt(to.replaceAll("?", "F"), 16);
    return a <= 0x41 && 0x41 <= b;
  });

/** The page's `@font-face` rule that covers Latin for `family`, and the sheet it came from. */
const latinFace = (family: string) => {
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // A sheet from another origin can't be read.
    }
    for (const rule of rules) {
      if (
        rule instanceof CSSFontFaceRule &&
        rule.style.getPropertyValue("font-family").replaceAll('"', "") === family &&
        coversLatin(rule.style.getPropertyValue("unicode-range") || "U+0-10FFFF")
      ) {
        return { rule, base: sheet.href ?? location.href };
      }
    }
  }
  return null;
};

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the font"));
    reader.readAsDataURL(blob);
  });

/** `@font-face` rules for `family` (Latin only), with the font file inlined. Empty if not found. */
const fontFaceCss = async (family: string) => {
  const face = latinFace(family);
  const url = face?.rule.style.getPropertyValue("src").match(/url\("?([^")]+)"?\)/)?.[1];
  if (!face || !url) return "";
  const response = await fetch(new URL(url, face.base));
  const data = await readAsDataUrl(await response.blob());
  const { style } = face.rule;
  return `@font-face{font-family:"${family}";font-style:${style.getPropertyValue("font-style") || "normal"};font-weight:${style.getPropertyValue("font-weight") || "normal"};src:url(${data})}`;
};

/** Fetched once per family. */
const fontCache = new Map<string, Promise<string>>();
const fontCss = (families: string[]) =>
  Promise.all(
    families.map((family) => {
      let css = fontCache.get(family);
      if (!css) {
        css = fontFaceCss(family).catch(() => "");
        fontCache.set(family, css);
      }
      return css;
    }),
  ).then((rules) => rules.join(""));

/** The first family each piece of text is set in. */
const familiesOf = (svg: SVGSVGElement) => [
  ...new Set(
    [...svg.querySelectorAll("text")].map((text) =>
      getComputedStyle(text).fontFamily.split(",")[0].trim().replaceAll('"', ""),
    ),
  ),
];

/**
 * Draws `svg` (or the `viewBox` region of it) into a new canvas of `size` device px, with the page's
 * fonts, over `background` if given (opaque, a snapshot covers whatever is under it).
 */
export const rasterize = async (
  svg: SVGSVGElement,
  size: Size,
  { viewBox, background }: { viewBox?: Rect; background?: string } = {},
) => {
  const css = await fontCss(familiesOf(svg));
  const image = new Image();
  image.src = svgToImageUrl(svg, size, { viewBox, css });
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context && background) {
    context.fillStyle = background;
    context.fillRect(0, 0, size.width, size.height);
  }
  context?.drawImage(image, 0, 0, size.width, size.height);
  return canvas;
};

/**
 * The average colour of `element`'s background with its `::before` texture on top (e.g. a grain):
 * a flat colour that's as bright as the textured background, for snapshots drawn over it.
 */
export const averageBackground = async (element: Element) => {
  const base = getComputedStyle(element).backgroundColor;
  const texture = getComputedStyle(element, "::before");
  const url = texture.backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1];
  if (!url) return base;
  const image = new Image();
  image.src = url;
  await image.decode();
  const width = image.naturalWidth || 160;
  const height = image.naturalHeight || 160;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return base;
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = Number(texture.opacity) || 1;
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
  }
  const pixels = width * height;
  return `rgb(${sum.map((channel) => Math.round(channel / pixels)).join(" ")})`;
};
