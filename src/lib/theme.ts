import { useSetting } from "./settings/client";
import type { Theme } from "./settings/schema";

const mediaQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

let currentTheme: Theme = "system";
let stopWatchingSystemTheme = () => {};

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

export const syncTheme = (theme: Theme) => {
  currentTheme = theme;
  applyTheme(currentTheme);
  watchSystemTheme();
};

export const initializeTheme = (theme: Theme) => {
  syncTheme(theme);
};

export const useTheme = () => {
  const [theme, setStoredTheme] = useSetting("theme");

  const setTheme = async (nextTheme: Theme) => {
    syncTheme(nextTheme);

    const persistedTheme = await setStoredTheme(nextTheme);
    syncTheme(persistedTheme);
  };

  return { theme, setTheme };
};
