import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Store from "electron-store";
import { app, BrowserWindow, ipcMain } from "electron";
import { devServerUrl } from "./env.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isDev = process.env.NODE_ENV === "development";
const themeValues = ["light", "dark", "system"] as const;
type Theme = (typeof themeValues)[number];

const parseTheme = (value: unknown): Theme =>
  themeValues.includes(value as Theme) ? (value as Theme) : "system";

const store = new Store<{ theme: Theme }>({
  defaults: {
    theme: "system",
  },
});

ipcMain.handle("theme:get", () => parseTheme(store.get("theme")));
ipcMain.handle("theme:set", (_event, value: unknown) => {
  store.set("theme", parseTheme(value));
});

const createWindow = () => {
  const window = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.loadFile(join(__dirname, "dist", "index.html"));
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
