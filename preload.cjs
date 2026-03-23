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
  inspectSaveTarget: (request) =>
    ipcRenderer.invoke("files:inspect-save-target", request),
  saveGeneratedFile: (request) =>
    ipcRenderer.invoke("files:save-generated", request),
});

contextBridge.exposeInMainWorld("chats", {
  listChats: () => ipcRenderer.invoke("chats:list"),
  getChat: (request) => ipcRenderer.invoke("chats:get", request),
  createChat: (request) => ipcRenderer.invoke("chats:create", request),
  setActiveChat: (request) => ipcRenderer.invoke("chats:set-active", request),
  updateChatOutput: (request) =>
    ipcRenderer.invoke("chats:update-output", request),
  deleteChat: (request) => ipcRenderer.invoke("chats:delete", request),
  sendMessage: (request) => ipcRenderer.invoke("chats:send-message", request),
});
