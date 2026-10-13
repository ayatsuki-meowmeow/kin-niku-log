import { createRoute } from "@tanstack/react-router";
import { Route as RootRoute } from "./__root";

function HomePage(): React.JSX.Element {
  return (
    <main className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold">Hello World</h1>
    </main>
  );
}

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage,
});
