// Pages as HTML, built with `vite build --ssr` and written into `dist` by `scripts/prerender.mjs`:
// the home page, so crawlers get its text without running JavaScript, and the 404 page. The
// browser doesn't hydrate them: `main.tsx` replaces them (see there).
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { prerender } from "react-dom/static";

import { routeTree } from "./routeTree.gen";

export const render = async (url: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  // An error inside a Suspense boundary doesn't reject: React prerenders a client-rendering
  // fallback instead. Collected here, so the build fails rather than shipping an empty page.
  const errors: unknown[] = [];
  const { prelude } = await prerender(<RouterProvider router={router} />, {
    onError: (error) => {
      errors.push(error);
    },
  });
  if (errors.length > 0) throw new AggregateError(errors, `Prerendering ${url} failed`);
  return new Response(prelude).text();
};
