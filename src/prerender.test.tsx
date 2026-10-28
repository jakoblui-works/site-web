// @vitest-environment node
// The prerender runs in Node (`scripts/prerender.mjs`), so its tests do too.
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Imports `render` as the build runs it. The test setup (jest-dom) puts a partial `CSS` global
 * into Node, which plain Node doesn't have; modules that feature-detect with it would then crash
 * while rendering, so it's removed first.
 */
const loadRender = async () => {
  delete (globalThis as { CSS?: unknown }).CSS;
  vi.resetModules();
  const { render } = await import("./prerender");
  return render;
};

/** Text without its tags, scripts and React's error templates, as a crawler reads it. */
const toText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<template[\s\S]*?<\/template>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ");

/** The page's top heading's text. */
const heading = (html: string) => toText(html.match(/<h1[\s>][\s\S]*?<\/h1>/)?.[0] ?? "");

/** The inline scripts' contents. */
const scripts = (html: string) =>
  [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(([, body]) => body);

describe("render", () => {
  afterEach(() => {
    vi.doUnmock("@/components/hero");
  });

  it.each([
    // The home page's hero: who and what.
    { url: "/", title: /Product\s*Engineer/, says: "Jakob Lui Abramson" },
    // The not-found page, for what was asked.
    { url: "/404", title: /No route here/, says: "GET /404" },
  ])("renders $url with its text and the router's state", async ({ url, title, says }) => {
    const render = await loadRender();
    const html = await render(url);
    expect(heading(html)).toMatch(title);
    expect(toText(html)).toContain(says);
    expect(scripts(html).some((script) => script.includes("$_TSR"))).toBe(true);
  });

  it("rejects when the page fails to render", async () => {
    vi.doMock("@/components/hero", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      Hero: () => {
        throw new Error("boom");
      },
    }));
    const render = await loadRender();
    await expect(render("/")).rejects.toThrow();
  });
});
