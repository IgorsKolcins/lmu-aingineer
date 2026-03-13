import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isTheme, useTheme } from "@/lib/theme";

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const RootLayout = () => {
  const { theme, setTheme } = useTheme();

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
            </nav>
            <section className="w-full max-w-sm rounded-lg border bg-card p-4 text-card-foreground">
              <div className="mb-3">
                <h2 className="text-sm font-semibold">Theme</h2>
                <p className="text-sm text-muted-foreground">
                  Choose light, dark, or follow the system.
                </p>
              </div>
              <RadioGroup
                className="gap-2 sm:grid-cols-3"
                onValueChange={(value) => {
                  if (isTheme(value)) {
                    void setTheme(value);
                  }
                }}
                value={theme}
              >
                {themeOptions.map(({ value, label }) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3 transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-accent/60"
                    key={value}
                  >
                    <RadioGroupItem value={value} />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </RadioGroup>
            </section>
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
