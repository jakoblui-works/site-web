import { useLocation } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header/app-header";
import { NotFound } from "@/components/not-found/not-found";

// Any URL without a route, and `404.html`. On the frost, as the home page with the x-ray open. Its
// picture's window runs off the screen's sides on phones.
export const NotFoundPage = () => {
  const path = useLocation({ select: (location) => location.pathname });
  return (
    <div className="not-found-page min-h-dvh overflow-x-clip">
      <AppHeader />
      <main>
        <NotFound path={path} />
      </main>
    </div>
  );
};
