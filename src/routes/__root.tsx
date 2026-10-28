import { Outlet, createRootRoute, useLocation } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";
import { SiteHeader } from "@/components/site-header";

// The header is rendered by the page: on the home page it's part of the x-ray's surface.
const RootComponent = () => {
  return <Outlet />;
};

// Any URL without a route. Built into `404.html` too (see `prerender.tsx`), which nginx serves
// for missing files.
const NotFoundPage = () => {
  const path = useLocation({ select: (location) => location.pathname });
  // On the frost, as the home page with the x-ray open. Its picture's window runs off the screen's
  // sides on phones.
  return (
    <div className="not-found-page min-h-dvh overflow-x-clip">
      <SiteHeader />
      <main>
        <NotFound path={path} />
      </main>
    </div>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});
