# site-web

The main site at jakoblui.com: one page that presents me as a product engineer. It has two layers:
- **Surface:** the header and the hero (role, name, links, "Tailor my CV").
- **Interior:** an "x-ray", an interactive graph of the platform's real infrastructure, seen through a window in the page. You can zoom into a node or a group of traces, and switch between the runtime and the build & deploy view.

Dark-only, violet brand. The design history and decisions are in `platform-docs` (`work/site-web.md`, architecture "site-web …").

## Commands
```sh
pnpm install
pnpm dev               # http://localhost:3000 (not prerendered)
pnpm lint
pnpm test              # Vitest: unit tests (jsdom) + Storybook stories in a Playwright browser
pnpm build             # vite build, prerender (see below), tsc --noEmit
pnpm preview           # serves dist/ (prerendered, but without nginx's 404 handling)
pnpm storybook         # :6006
pnpm og                # public/og.png from the OgCard story (needs Storybook running)
```

## Template
Made from `web-template` (`.copier-answers.yml`). Template changes arrive through `copier update --trust`; don't edit the answers by hand. site-web's own additions to template files: the `theme-color`, `og:image` lines and `data-xray-link` script in `index.html`, the `data-xray-link` condition in `main.tsx`, everything below the template's line in `styles.css`, `simple-icons` and the `og` script in `package.json`, the `ResizeObserver` and `document.fonts` stubs in `test-setup.ts`. The favicons come from the template (`pnpm icons` lives in the template repo).

## Stack
React 19, Vite, TanStack Router (file routes in `src/routes`; `routeTree.gen.ts` is generated), Tailwind 4, shadcn on Base UI (`src/components/ui`), zod, Storybook 10, Vitest. Same template as cv-web. Served by nginx (`nginx.conf`).

## Layout
- `src/routes/index.tsx`: the home page. The x-ray state lives in the URL: `?xray` opens it, `?xray=<node or trace group>` zooms in, `&group=` is the group a node was entered from, and `&view=deploy` switches graphs.
- `src/routes/__root.tsx`: the root layout; wires the 404 page (`notFoundComponent`).
- `src/lib/graphs/`: the graphs as data (`Graph`: nodes, edges, layouts, node details, trace groups). There's one per view (`runtime`, `deploy`) plus the 404 page's small one (`not-found`). Positions are hand-placed per layout (landscape and portrait) on the `GRID`.
- `src/lib/`: everything about graphs that isn't rendering: trace routing (`infra-graph.ts`), zoom planning (`zoom.ts`), trace groups and hover picking (`trace-groups.ts`), and the x-ray window's shape (`xray-window.ts`). Most tests live here and run once per graph.
- `src/components/`: one folder per component with its stories, tests and single-use helpers, files named after it (no `index.tsx`, no barrels); the stories' titles follow the folders. `ui/` stays flat, since the shadcn CLI expects it.
  - `xray/`: the x-ray's pieces. `infra-graph/` draws a graph; `xray/` is the interior, with camera, zoom and gestures; `frosted-graph/` the blurred copies behind the surface and in the look-inside panel; `infra-outline/` the x-ray as hidden text.
  - `hero/`, `work-menu/`, `brand-icons/`
  - `app-header/`: the shared header (`@jakoblui-works/shared-ui`) as the hub shows it, with the work menu; used by the home page and the 404 page.
  - `not-found/`: the 404 page's picture and text; `not-found-page/` adds the header and the frost around it.
  - `og-card/`: the og:image.
- `src/hooks/`: `useXrayWindow` (bakes the window's masks). `useZoomSnapshots` (Firefox's bitmap snapshots while zooming) lives in `components/xray/xray/`.
- `src/styles.css`: theme tokens and the x-ray's layering, window and grain (commented in place).
- `src/prerender.tsx` + `scripts/prerender.mjs`: prerendering (below). `src/router.tsx`: the router, shared by it and `main.tsx`.

## Prerendering and 404s
`pnpm build` renders `/` and the not-found page in Node and writes them into `dist/index.html` and `dist/404.html`, so crawlers get the text without running JavaScript. They're rendered with TanStack Router's SSR setup (`createRequestHandler`, rendering with React's `prerender` rather than the router's `renderRouterToString`, which doesn't fail on errors inside a Suspense boundary; `<Scripts />` in `__root.tsx` writes the router's state into the page), and the browser hydrates each one on a URL that renders the same as the one it was rendered for (`data-prerendered="<url>"`: same path, same search params after the routes' schemas, so `?fbclid` and the like don't count), so it isn't drawn twice. Anywhere else (an `?xray` link, a made-up path, `pnpm dev`) `main.tsx` replaces it with `createRoot`. `index.html` stays the document; the root route doesn't render `<html>`. nginx serves only real files and answers anything else with `404.html` and a 404 status.
- **Rendering must work in Node, and match the browser's first render.** Don't read `window` or `document` while rendering (effects are fine), or guard it as `xray.tsx` does, and only where it doesn't change the first render's markup: a difference makes React drop the page and render it again. A render error fails the build on purpose.
- **Node details live in the outline too.** The x-ray only mounts a node's details when it's zoomed into, so the page's text for crawlers and screen readers is `InfraOutline`, its own landmark after `<main>`. It's generated from the graph data, so new nodes appear in it automatically.
- **Heads are static:** in `index.html`, shared by every URL, because previews and crawlers don't run JavaScript. `404.html`'s head is rewritten in `scripts/prerender.mjs`.
- **The prerendered page is the closed home page,** so on `?xray` links it's hidden until the app renders (`data-xray-link` from an inline script in `index.html`, `data-prerendered` around the prerendered markup).
- **Checking hydration:** after a change to what the home page renders, load the built page (`pnpm build && pnpm preview`) in Chrome and Firefox and look for hydration errors in the console.

## Gotchas
- **The x-ray must stay true.** It describes the real platform, so a change to what runs, connects, builds or deploys anywhere on the platform means updating `src/lib/graphs/`, or noting the follow-up in `platform-docs/backlog.md`.
- **Graph layout tests:** a layout change has to pass `infra-graph.test.ts`. It checks that every node is placed, casing membership, no overlaps, and no trace running through a node it doesn't connect. It doesn't check traces against the casing label.
- **Firefox:** zooming uses bitmap snapshots instead of the live SVG (it rasterizes SVG on the CPU at every scale). Check zoom changes in Firefox as well as Chrome.
- **Mask images in Firefox:** Firefox decodes a mask image only once an element is drawn with it, and until then leaves the element out or draws it unmasked. So don't set new mask URLs, or switch an element to a mask it hasn't drawn yet, during a transition. The x-ray keeps each mask drawn ahead of its use (see the x-ray block in `styles.css` and `useXrayWindow`). Headless Firefox doesn't show these one-frame flashes; a Firefox Profiler recording with screenshots does.
- **nginx caching:** `/assets/` is cached for a year as `immutable`, so anything served from there must have a content hash in its name. Everything else is `no-cache`. Keep everything in the one `location /`, because a nested location's `add_header` drops the `Cache-Control` one (in `nginx.storybook.conf`, the CORS headers Storybook's composition needs).
- **Deploys build two images** (`site-web` and `site-web-storybook`) with their own nginx files (`nginx.conf`, `nginx.storybook.conf`); storybook-host composes the Storybook. CI runs both builds too, so a prerender error fails the pull request.
- **Repo-root `robots.txt`** is Storybook's (disallow all). The site's is `public/robots.txt`.
- **The header, site switcher and shared theme tokens come from `@jakoblui-works/shared-ui`** (GitHub Packages). Installing needs a token with `read:packages`, even though the package is public (see shared-ui's `CLAUDE.md`). CI uses `GITHUB_TOKEN`, and the Docker builds take it as `--secret id=npm_token,env=NODE_AUTH_TOKEN`. `styles.css` keeps only site-web's palette and x-ray CSS; the fonts are the shared theme's, which are site-web's. If `shadcn add` writes tokens into it, move the shared ones into shared-ui. Over the open x-ray, `useXrayWindow` finds the logo by the package's `data-slot="site-logo"`.
