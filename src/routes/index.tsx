import { createFileRoute } from "@tanstack/react-router";

const HomePage = () => (
  <h1 className="text-2xl font-bold text-blue-500">Hello World</h1>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
