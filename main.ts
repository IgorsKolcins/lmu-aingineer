import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  createChat,
  deleteChat,
  getChat,
  listChats,
  sendChatMessage,
  setActiveChat,
  updateChatOutput,
} from "./src/lib/chats/main.ts";
import { devServerUrl } from "./env.ts";
import {
  inspectSaveTarget,
  openDirectory,
  openFile,
  saveGeneratedFile,
} from "./src/lib/files/main.ts";
import { getSettings, setSetting } from "./src/lib/settings/main.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appRoot =
  basename(__dirname) === "dist-electron" ? join(__dirname, "..") : __dirname;
const electronDir =
  basename(__dirname) === "dist-electron" ? __dirname : appRoot;
const rendererUrl = process.env.ELECTRON_RENDERER_URL?.trim() || null;
const isDev = Boolean(rendererUrl);

app.setName("LMU AIngineer");

if (process.platform === "win32") {
  app.setAppUserModelId("com.lmu.aingineer");
}

ipcMain.handle("files:open", (event, options: unknown) =>
  openFile(BrowserWindow.fromWebContents(event.sender), options),
);
ipcMain.handle("files:open-directory", (event, options: unknown) =>
  openDirectory(BrowserWindow.fromWebContents(event.sender), options),
);
ipcMain.handle("files:inspect-save-target", (_event, request: unknown) =>
  inspectSaveTarget(request),
);
ipcMain.handle("files:save-generated", (_event, request: unknown) =>
  saveGeneratedFile(request),
);
ipcMain.handle("chats:list", () => listChats());
ipcMain.handle("chats:get", (_event, request: unknown) => getChat(request));
ipcMain.handle("chats:create", (_event, request: unknown) =>
  createChat(request),
);
ipcMain.handle("chats:set-active", (_event, request: unknown) =>
  setActiveChat(request),
);
ipcMain.handle("chats:update-output", (_event, request: unknown) =>
  updateChatOutput(request),
);
ipcMain.handle("chats:delete", (_event, request: unknown) =>
  deleteChat(request),
);
ipcMain.handle("chats:send-message", (_event, request: unknown) =>
  sendChatMessage(request),
);
ipcMain.handle("settings:get", () => getSettings());
ipcMain.handle("settings:set", (_event, key: unknown, value: unknown) =>
  setSetting(key, value),
);

const createWindow = () => {
  const window = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    webPreferences: {
      contextIsolation: true,
      preload: join(electronDir, "preload.cjs"),
    },
  });

  if (isDev) {
    window.loadURL(rendererUrl ?? devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.loadFile(join(appRoot, "dist", "index.html"));
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
