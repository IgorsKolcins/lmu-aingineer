import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const HomePage = () => (
  <>
    <h1 className="text-2xl font-bold text-blue-500">Hello World</h1>
    <Button>Click me</Button>
  </>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
