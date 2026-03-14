import { z } from "zod";

export const themeSchema = z
  .enum(["light", "dark", "system"])
  .default("system");

const settingSchemas = {
  theme: themeSchema,
} as const;

export const settingsSchema = z.object(settingSchemas);

export type AppSettings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof AppSettings;
export type Theme = AppSettings["theme"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const defaultSettings = Object.freeze(settingsSchema.parse({}));

const settingKeys = Object.keys(settingSchemas) as SettingKey[];

export const isSettingKey = (value: unknown): value is SettingKey =>
  typeof value === "string" && settingKeys.includes(value as SettingKey);

export const isTheme = (value: unknown): value is Theme =>
  themeSchema.safeParse(value).success;

const settingParsers = {
  theme: (value: unknown) =>
    themeSchema.catch(defaultSettings.theme).parse(value),
} satisfies {
  [K in SettingKey]: (value: unknown) => AppSettings[K];
};

export const parseSettingValue = <K extends SettingKey>(
  key: K,
  value: unknown,
) => settingParsers[key](value);

export const sanitizeSettings = (value: unknown) => {
  const source = isRecord(value) ? value : {};
  const sanitized = Object.fromEntries(
    settingKeys.map((key) => [key, parseSettingValue(key, source[key])]),
  );

  return settingsSchema.parse(sanitized);
};
