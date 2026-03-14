import { useSyncExternalStore } from "react";
import {
  defaultSettings,
  sanitizeSettings,
  type AppSettings,
  type SettingKey,
} from "./schema";

type SettingsBridge = {
  getSettings: () => Promise<AppSettings>;
  setSetting: <K extends SettingKey>(
    key: K,
    value: AppSettings[K],
  ) => Promise<AppSettings>;
};

declare global {
  interface Window {
    settings?: SettingsBridge;
  }
}

let currentSettings = defaultSettings;
let settingsInitialization: Promise<AppSettings> | null = null;

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const replaceSettings = (value: unknown) => {
  currentSettings = sanitizeSettings(value);
  notify();

  return currentSettings;
};

const readBridge = () => window.settings;

export const initializeSettings = () => {
  if (settingsInitialization) {
    return settingsInitialization;
  }

  settingsInitialization =
    readBridge()
      ?.getSettings()
      .then(replaceSettings)
      .catch(() => replaceSettings(defaultSettings)) ??
    Promise.resolve(currentSettings);

  return settingsInitialization;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentSettings;

export const setSetting = async <K extends SettingKey>(
  key: K,
  value: AppSettings[K],
) => {
  const optimisticSettings = replaceSettings({
    ...currentSettings,
    [key]: value,
  });

  const persistedSettings = await readBridge()
    ?.setSetting(key, value)
    .catch(() => optimisticSettings);

  return replaceSettings(persistedSettings ?? optimisticSettings);
};

export const useSettings = () => {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { settings, setSetting };
};

export const useSetting = <K extends SettingKey>(key: K) => {
  const { settings, setSetting } = useSettings();

  return [
    settings[key],
    (value: AppSettings[K]) => setSetting(key, value).then((next) => next[key]),
  ] as const;
};
