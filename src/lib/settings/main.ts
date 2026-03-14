import Store from "electron-store";
import {
  defaultSettings,
  isSettingKey,
  parseSettingValue,
  sanitizeSettings,
} from "./schema.ts";

type PersistedSettingsStore = {
  settings?: unknown;
  theme?: unknown;
};

const store = new Store<PersistedSettingsStore>({
  defaults: {},
});

const writeSettings = (value: unknown) => {
  const settings = sanitizeSettings(value);

  store.set("settings", settings);
  store.delete("theme");

  return settings;
};

const readLegacySettings = () => ({
  ...defaultSettings,
  theme: parseSettingValue("theme", store.get("theme")),
});

const readStoredSettings = () => {
  const settings = store.get("settings");

  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings;
  }

  return readLegacySettings();
};

export const getSettings = () => writeSettings(readStoredSettings());

export const setSetting = (key: unknown, value: unknown) => {
  if (!isSettingKey(key)) {
    throw new Error(`Invalid setting key: ${String(key)}`);
  }

  return writeSettings({
    ...getSettings(),
    [key]: parseSettingValue(key, value),
  });
};
