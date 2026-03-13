import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
import { devServerUrl } from "./env.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isDev = process.env.NODE_ENV === "development";

const createWindow = () => {
  const window = new BrowserWindow({
    width: 900,
    height: 700,
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
