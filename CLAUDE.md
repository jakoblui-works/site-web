# site-web

The main site at jakoblui.com: one page presenting me as a product engineer. A surface (header and hero) over an interior, the "x-ray": an interactive graph of the platform's real infrastructure, in two views (runtime, build & deploy). Made from `web-template` (Copier); `.copier-answers.yml` records the version. Design and decisions: `platform-docs` (`work/site-web.md`).

## Commands
```sh
pnpm install
pnpm dev               # http://localhost:3000 (not prerendered)
pnpm lint
pnpm test              # Vitest: unit tests (jsdom) + Storybook stories in a Playwright browser
pnpm build             # vite build, prerender, tsc --noEmit
pnpm preview           # serves dist/ (prerendered, but without nginx's 404 handling)
pnpm storybook         # :6006
pnpm og                # public/og.png from the OgCard story (needs Storybook running)
copier update --trust  # pull template changes; commit first
```

## Layout
- `src/routes/`: file routes (`routeTree.gen.ts` is generated). `index.tsx` is the home page and holds the x-ray's URL state; `__root.tsx` holds the 404 route.
- `src/lib/graphs/`: the graphs as data (`runtime`, `deploy`, and the 404 page's `not-found`).
- `src/lib/`: graph logic that isn't rendering (routing, zoom, trace groups, window shape). Most tests live here.
- `src/components/`: one folder per component with its stories and tests, files named after it (no `index.tsx`, no barrels); story titles follow the folders. `ui/` (shadcn) stays flat, since the shadcn CLI expects it. `xray/` holds the x-ray's pieces (`infra-graph/`, `xray/`, `frosted-graph/`, `infra-outline/`).
- `src/hooks/use-xray-window.ts`: bakes the window's masks.
- `src/prerender.tsx` + `scripts/prerender.mjs`: prerendering. `src/router.tsx`: the router, shared by it and `main.tsx`.
- `nginx.conf` + `Dockerfile`: the site image. `nginx.storybook.conf` + `Dockerfile.storybook`: the Storybook image, which storybook-host composes. Deploys build both.

## Template
Don't edit `.copier-answers.yml` by hand. Keep this repo's own additions at least one line away from template lines, or every template change to those lines conflicts on `copier update`. `README.md`, `CLAUDE.md`, `src/routes/index.tsx`, `src/components/app-header/app-header.tsx`, `src/components/not-found-page/not-found-page.tsx` and `public/sitemap.xml` are this repo's own after the first render; updates never touch them. site-web's additions to template files, to keep: the `theme-color`, `og:image` lines and `data-xray-link` script in `index.html`; the `data-xray-link` condition in `main.tsx`; everything below the template's line in `styles.css`; `simple-icons` and the `og` script in `package.json`; the `ResizeObserver` and `document.fonts` stubs in `test-setup.ts`.

## Rules
- **Render in Node and match the first render.** No `window` or `document` while rendering (effects are fine). A render error fails the build on purpose.
- **Check hydration** after a change to what the home page renders: `pnpm build && pnpm preview`, in Chrome and Firefox, no hydration errors in the console.
- **nginx serves only real files** (`try_files $uri $uri/ =404`): a route without a prerendered file in `scripts/prerender.mjs`'s `pages` is served `404.html` with a 404 status, though it still renders client-side.
- **Heads are static,** in `index.html`; `404.html`'s is rewritten in `scripts/prerender.mjs`. The prerendered page is the closed home page, so `?xray` links hide it until the app renders.
- **The x-ray must stay true.** A change to what runs, connects, builds or deploys anywhere on the platform means updating `src/lib/graphs/`, or noting the follow-up in `platform-docs/backlog.md`.
- **The site-transition head script** in `index.html` takes its names from shared-ui; `src/site-transition-head-script.test.ts` checks them.
- **A layout change must pass `infra-graph.test.ts`** (it doesn't check traces against the casing label).
- **Check zoom changes in Firefox as well as Chrome.**
- **Firefox mask images:** don't set new mask URLs, or switch an element to a mask it hasn't drawn, during a transition.
- **nginx:** anything under `/assets/` needs a content hash in its name. Keep everything in the one `location /`.
- **The header, theme tokens and fonts come from shared-ui** (`@jakoblui-works/shared-ui`); `styles.css` holds only site-web's palette and x-ray CSS. If `shadcn add` writes tokens into it, move the shared ones into shared-ui. A new site needs its entry in shared-ui's `sites.ts` first, with the same palette as `styles.css`. `useXrayWindow` finds the logo by `data-slot="site-logo"`.
- **Installing needs a GitHub Packages token** (`NODE_AUTH_TOKEN`, `read:packages`) for `@jakoblui-works/shared-ui`, even though it's public. CI uses `GITHUB_TOKEN`: shared-ui's package settings must give this repo read access ("Manage Actions access").
- **Repo-root `robots.txt`** is Storybook's (disallow all). The site's is `public/robots.txt`.
