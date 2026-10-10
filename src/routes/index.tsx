import { createFileRoute } from "@tanstack/react-router";

import { Hero } from "@/components/hero";

const HomeComponent = () => {
  return (
    <main>
      <Hero />
    </main>
  );
};

export const Route = createFileRoute("/")({
  component: HomeComponent,
});
