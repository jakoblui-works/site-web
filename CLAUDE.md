# site-web

Main site at jakoblui.com. Planned: a static "product page" where the product is me (a product developer/engineer).

## Commands
```sh
pnpm install
pnpm dev               # http://localhost:3000
pnpm lint
pnpm test              # Vitest, including Storybook stories in a Playwright browser
pnpm build             # vite build + tsc --noEmit
pnpm storybook         # :6006
```

## Stack
React 19, Vite, TanStack Router (file routes in `src/routes`, `routeTree.gen.ts` is generated), Tailwind 4, shadcn on Base UI (`src/components`), Storybook 10. Same template as cv-web.

## Gotchas
- Deploys build two images (`site-web`, `site-web-storybook`); storybook-host composes the Storybook.
