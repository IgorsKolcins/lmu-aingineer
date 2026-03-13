import { useSyncExternalStore } from "react";

const themeValues = ["light", "dark", "system"] as const;

export type Theme = (typeof themeValues)[number];

export const isTheme = (value: unknown): value is Theme =>
  themeValues.includes(value as Theme);

declare global {
  interface Window {
    theme?: {
      getTheme: () => Promise<Theme>;
      setTheme: (theme: Theme) => Promise<void>;
    };
  }
}

const mediaQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

let currentTheme: Theme = "system";
let stopWatchingSystemTheme = () => {};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const getSystemTheme = () => (mediaQuery().matches ? "dark" : "light");

const applyTheme = (theme: Theme) => {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
};

const watchSystemTheme = () => {
  stopWatchingSystemTheme();

  if (currentTheme !== "system") {
    return;
  }

  const query = mediaQuery();
  const handleChange = () => applyTheme("system");

  query.addEventListener("change", handleChange);

  stopWatchingSystemTheme = () => {
    query.removeEventListener("change", handleChange);
  };
};

export const initializeTheme = async () => {
  const storedTheme = await window.theme
    ?.getTheme?.()
    .catch(() => "system" satisfies Theme);

  currentTheme = isTheme(storedTheme) ? storedTheme : "system";
  applyTheme(currentTheme);
  watchSystemTheme();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentTheme;

export const setTheme = async (theme: Theme) => {
  currentTheme = theme;
  applyTheme(theme);
  watchSystemTheme();
  notify();
  await window.theme?.setTheme?.(theme);
};

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { theme, setTheme };
};
