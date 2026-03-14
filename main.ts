import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { devServerUrl } from "./env.ts";
import { getSettings, setSetting } from "./src/lib/settings/main.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isDev = process.env.NODE_ENV === "development";

ipcMain.handle("settings:get", () => getSettings());
ipcMain.handle("settings:set", (_event, key: unknown, value: unknown) =>
  setSetting(key, value),
);

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
