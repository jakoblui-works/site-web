import { SiteHeader } from "@jakoblui-works/shared-ui";
import { Link } from "@tanstack/react-router";

import { WorkMenu } from "@/components/work-menu";
import { projects } from "@/lib/projects";

// The shared header as the hub shows it, on the home page and the 404 page. Over the open x-ray,
// its logo (`data-slot="site-logo"`) and the work menu stand on solid frost (see `useXrayWindow`).
export const AppHeader = () => {
  return (
    <SiteHeader current="www" homeLink={<Link to="/" />}>
      <WorkMenu projects={projects} />
    </SiteHeader>
  );
};
