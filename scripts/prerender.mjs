// Writes the prerendered pages (`src/prerender.tsx`, built to dist-ssr) into dist, each from
// dist/index.html with the page in `#app`. Run by `pnpm build`, after both Vite builds.
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const ssrDir = path.join(root, "dist-ssr");

const { render } = await import(path.join(ssrDir, "prerender.js"));

const template = await readFile(path.join(dist, "index.html"), "utf8");
const placeholder = '<div id="app"></div>';
if (!template.includes(placeholder)) {
  console.error(`No ${placeholder} in dist/index.html to prerender into.`);
  process.exit(1);
}

/** The 404 page's head: its own title, without the home page's description, canonical and previews. */
const notFoundHead = (html) =>
  html
    .replace(/<title>.*<\/title>/, "<title>Page not found - Jakob Lui</title>")
    .replace(/<meta\s+(?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\s*/g, "")
    .replace(/<link rel="canonical"[^>]*>\s*/, "")
    .replace(/<!--[\s\S]*?-->\s*/g, "");

const pages = [
  { url: "/", file: "index.html", head: (html) => html },
  // Any path without a route renders the not-found page.
  { url: "/404", file: "404.html", head: notFoundHead },
];

// Marked, so it can be hidden where it doesn't match the URL (`[data-prerendered]` in styles.css);
// the app's render replaces it, marker and all.
for (const { url, file, head } of pages) {
  const html = await render(url);
  await writeFile(
    path.join(dist, file),
    head(template).replace(placeholder, `<div id="app"><div data-prerendered>${html}</div></div>`),
  );
}
await rm(ssrDir, { recursive: true });
