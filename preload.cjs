/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settings", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),
});

contextBridge.exposeInMainWorld("files", {
  openFile: (options) => ipcRenderer.invoke("files:open", options),
  openDirectory: (options) =>
    ipcRenderer.invoke("files:open-directory", options),
  saveGeneratedFile: (request) =>
    ipcRenderer.invoke("files:save-generated", request),
});

contextBridge.exposeInMainWorld("ai", {
  askAboutFile: (request) => ipcRenderer.invoke("ai:ask-about-file", request),
});
