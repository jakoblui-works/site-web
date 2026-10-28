// Writes the prerendered home page (`src/prerender.tsx`, built to dist-ssr) into
// dist/index.html's `#app`. Run by `pnpm build`, after both Vite builds.
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const indexPath = path.join(root, "dist/index.html");
const ssrDir = path.join(root, "dist-ssr");

const { render } = await import(path.join(ssrDir, "prerender.js"));
const html = await render();

const index = await readFile(indexPath, "utf8");
const placeholder = '<div id="app"></div>';
if (!index.includes(placeholder)) {
  console.error(`No ${placeholder} in dist/index.html to prerender into.`);
  process.exit(1);
}
await writeFile(indexPath, index.replace(placeholder, `<div id="app">${html}</div>`));
await rm(ssrDir, { recursive: true });
