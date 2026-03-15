import { RiSettings3Line } from "@remixicon/react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

const RootLayout = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SidebarProvider className="min-h-screen items-start">
        <Sidebar className="fixed inset-y-0 left-0 h-svh" collapsible="none">
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <Link
              className="block rounded-none px-1 py-2 text-lg font-semibold tracking-[0.18em] uppercase transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              to="/"
            >
              AIngineer
            </Link>
          </SidebarHeader>
          <SidebarContent className="p-4" />
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <Button asChild className="w-full justify-start" variant="ghost">
              <Link to="/settings">
                <RiSettings3Line />
                Settings
              </Link>
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-h-screen rounded-none ml-[var(--sidebar-width)]">
          <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
};

export const Route = createRootRoute({
  component: RootLayout,
});
