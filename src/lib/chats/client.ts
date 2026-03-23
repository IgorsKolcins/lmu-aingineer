import { useSyncExternalStore } from "react";
import {
  chatStateSnapshotSchema,
  createChatRequestSchema,
  deleteChatRequestSchema,
  getChatRequestSchema,
  sendChatMessageRequestSchema,
  setActiveChatRequestSchema,
  updateChatOutputRequestSchema,
  type ChatStateSnapshot,
  type CreateChatRequest,
  type DeleteChatRequest,
  type GetChatRequest,
  type SendChatMessageRequest,
  type SetActiveChatRequest,
  type UpdateChatOutputRequest,
} from "./types";

type ChatsBridge = {
  listChats: () => Promise<ChatStateSnapshot>;
  getChat: (request: GetChatRequest) => Promise<ChatStateSnapshot>;
  createChat: (request: CreateChatRequest) => Promise<ChatStateSnapshot>;
  deleteChat: (request: DeleteChatRequest) => Promise<ChatStateSnapshot>;
  setActiveChat: (request: SetActiveChatRequest) => Promise<ChatStateSnapshot>;
  updateChatOutput: (
    request: UpdateChatOutputRequest,
  ) => Promise<ChatStateSnapshot>;
  sendMessage: (request: SendChatMessageRequest) => Promise<ChatStateSnapshot>;
};

declare global {
  interface Window {
    chats?: ChatsBridge;
  }
}

const emptySnapshot = chatStateSnapshotSchema.parse({
  chats: [],
  activeChatId: null,
  activeChat: null,
});

let currentSnapshot = emptySnapshot;
let initialization: Promise<ChatStateSnapshot> | null = null;

const listeners = new Set<() => void>();

const readBridge = () => window.chats;

const notify = () => {
  listeners.forEach((listener) => listener());
};

const replaceSnapshot = (value: unknown) => {
  currentSnapshot = chatStateSnapshotSchema.parse(value);
  notify();

  return currentSnapshot;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentSnapshot;

const runAndReplace = async (action: Promise<unknown>) =>
  replaceSnapshot(await action);

export const initializeChats = () => {
  if (initialization) {
    return initialization;
  }

  initialization =
    readBridge()
      ?.listChats()
      .then(replaceSnapshot)
      .catch(() => replaceSnapshot(emptySnapshot)) ??
    Promise.resolve(currentSnapshot);

  return initialization;
};

export const useChats = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const createChat = (request: CreateChatRequest = {}) =>
  runAndReplace(
    readBridge()?.createChat(createChatRequestSchema.parse(request)) ??
      Promise.resolve(currentSnapshot),
  );

export const deleteChat = (request: DeleteChatRequest) =>
  runAndReplace(
    readBridge()?.deleteChat(deleteChatRequestSchema.parse(request)) ??
      Promise.resolve(currentSnapshot),
  );

export const setActiveChat = (request: SetActiveChatRequest) =>
  runAndReplace(
    readBridge()?.setActiveChat(setActiveChatRequestSchema.parse(request)) ??
      Promise.resolve(currentSnapshot),
  );

export const refreshActiveChat = (request: GetChatRequest) =>
  runAndReplace(
    readBridge()?.getChat(getChatRequestSchema.parse(request)) ??
      Promise.resolve(currentSnapshot),
  );

export const updateChatOutput = (request: UpdateChatOutputRequest) =>
  runAndReplace(
    readBridge()?.updateChatOutput(
      updateChatOutputRequestSchema.parse(request),
    ) ?? Promise.resolve(currentSnapshot),
  );

export const sendChatMessage = (request: SendChatMessageRequest) =>
  runAndReplace(
    readBridge()?.sendMessage(sendChatMessageRequestSchema.parse(request)) ??
      Promise.resolve(currentSnapshot),
  );
