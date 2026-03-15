import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

const RootLayout = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6">
        <header className="flex flex-col gap-6 border-b pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link className="[&.active]:text-primary" to="/">
                Home
              </Link>
              <Link className="[&.active]:text-primary" to="/about">
                About
              </Link>
              <Link className="[&.active]:text-primary" to="/settings">
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <Outlet />
      </div>
    </main>
  );
};

export const Route = createRootRoute({
  component: RootLayout,
});
