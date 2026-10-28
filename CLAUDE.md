# site-web

The main site at jakoblui.com: one page that presents me as a product engineer. It has two layers:
- **Surface:** the header and the hero (role, name, links, "Tailor my CV").
- **Interior:** an "x-ray", an interactive graph of the platform's real infrastructure, seen through a window in the page. You can zoom into a node or a group of traces, and switch between the runtime and the build & deploy view.

Dark-only, violet brand. The design history and decisions are in `platform-docs` (roadmap "Current: site-web", architecture "site-web …").

## Commands
```sh
pnpm install
pnpm dev               # http://localhost:3000 (not prerendered)
pnpm lint
pnpm test              # Vitest: unit tests (jsdom) + Storybook stories in a Playwright browser
pnpm build             # vite build, prerender (see below), tsc --noEmit
pnpm preview           # serves dist/ (prerendered, but without nginx's 404 handling)
pnpm storybook         # :6006
pnpm icons             # favicon.ico + apple-touch-icon.png from public/icon.svg
pnpm og                # public/og.png from the OgCard story (needs Storybook running)
```

## Stack
React 19, Vite, TanStack Router (file routes in `src/routes`; `routeTree.gen.ts` is generated), Tailwind 4, shadcn on Base UI (`src/components/ui`), zod, Storybook 10, Vitest. Same template as cv-web. Served by nginx (`nginx.conf`).

## Layout
- `src/routes/index.tsx`: the home page. The x-ray state lives in the URL: `?xray` opens it, `?xray=<node or trace group>` zooms in, `&group=` is the group a node was entered from, and `&view=deploy` switches graphs.
- `src/routes/__root.tsx`: the root layout and the 404 page (`notFoundComponent`).
- `src/lib/graphs/`: the graphs as data (`Graph`: nodes, edges, layouts, node details, trace groups). There's one per view (`runtime`, `deploy`) plus the 404 page's small one (`not-found`). Positions are hand-placed per layout (landscape and portrait) on the `GRID`.
- `src/lib/`: everything about graphs that isn't rendering: trace routing (`infra-graph.ts`), zoom planning (`zoom.ts`), trace groups and hover picking (`trace-groups.ts`), and the x-ray window's shape (`xray-window.ts`). Most tests live here and run once per graph.
- `src/components/`:
  - `infra-graph.tsx`: draws a graph.
  - `xray.tsx`: the interior, with camera, zoom and gestures.
  - `frosted-graph.tsx`: the blurred copies behind the surface and in the look-inside panel.
  - `hero.tsx`, `site-header.tsx`, `work-menu.tsx`, `site-switcher.tsx`
  - `infra-outline.tsx`: the x-ray as hidden text.
  - `not-found.tsx`
  - `og-card.tsx`: the og:image.
- `src/hooks/`: `useXrayWindow` (bakes the window's masks) and `useZoomSnapshots` (Firefox's bitmap snapshots while zooming).
- `src/styles.css`: theme tokens and the x-ray's layering, window and grain (commented in place).
- `src/prerender.tsx` + `scripts/prerender.mjs`: prerendering (below).

## Prerendering and 404s
`pnpm build` renders `/` and the not-found page in Node and writes them into `dist/index.html` and `dist/404.html`, so crawlers get the text without running JavaScript. The browser doesn't hydrate them: `main.tsx` replaces them with `createRoot`, because TanStack Router renders a different tree on the server without its full SSR setup. nginx serves only real files and answers anything else with `404.html` and a 404 status.
- **Rendering must work in Node.** Don't read `window` or `document` while rendering (effects are fine), or guard it as `xray.tsx` does. A render error fails the build on purpose.
- **Node details live in the outline too.** The x-ray only mounts a node's details when it's zoomed into, so the page's text for crawlers and screen readers is `InfraOutline`. It's generated from the graph data, so new nodes appear in it automatically.
- **Heads are static:** in `index.html`, shared by every URL, because previews and crawlers don't run JavaScript. `404.html`'s head is rewritten in `scripts/prerender.mjs`.

## Gotchas
- **The x-ray must stay true.** It describes the real platform, so a change to what runs, connects, builds or deploys anywhere on the platform means updating `src/lib/graphs/`, or noting the follow-up in `platform-docs/backlog.md`.
- **Graph layout tests:** a layout change has to pass `infra-graph.test.ts`. It checks that every node is placed, casing membership, no overlaps, and no trace running through a node it doesn't connect. It doesn't check traces against the casing label.
- **Firefox:** zooming uses bitmap snapshots instead of the live SVG (it rasterizes SVG on the CPU at every scale). Check zoom changes in Firefox as well as Chrome.
- **Deploys build two images** (`site-web` and `site-web-storybook`) that share `nginx.conf`; storybook-host composes the Storybook. CI runs lint and tests but not `pnpm build`, so a prerender error only shows in the deploy's Docker build.
- **Repo-root `robots.txt`** is Storybook's (disallow all). The site's is `public/robots.txt`.
