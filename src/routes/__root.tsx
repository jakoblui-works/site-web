import { Outlet, createRootRoute } from "@tanstack/react-router";

// The header is rendered by the page: on the home page it's part of the x-ray's surface.
const RootComponent = () => {
  return <Outlet />;
};

export const Route = createRootRoute({
  component: RootComponent,
});
