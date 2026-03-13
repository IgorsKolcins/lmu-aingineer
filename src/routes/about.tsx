import { createFileRoute } from "@tanstack/react-router";

const AboutPage = () => (
  <h1 className="text-2xl font-bold text-red-500">Hello World From Page Two</h1>
);

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
