// The home page as HTML, built with `vite build --ssr` and written into `dist/index.html` by
// `scripts/prerender.mjs`, so crawlers get the page's text without running JavaScript. The
// browser doesn't hydrate it: `main.tsx` replaces it (see there).
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { prerender } from "react-dom/static";

import { routeTree } from "./routeTree.gen";

export const render = async () => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
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
  if (errors.length > 0) throw new AggregateError(errors, "Prerendering the home page failed");
  return new Response(prelude).text();
};
