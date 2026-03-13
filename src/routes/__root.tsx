import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

const RootLayout = () => (
  <main>
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </div>
  </main>
);

export const Route = createRootRoute({
  component: RootLayout,
});
