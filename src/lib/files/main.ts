import { writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, parse } from "node:path";
import { dialog, type BrowserWindow, type OpenDialogOptions } from "electron";
import {
  openDirectoryOptionsSchema,
  openFileOptionsSchema,
  saveGeneratedFileRequestSchema,
  saveGeneratedFileResponseSchema,
  selectedDirectorySchema,
  selectedFileSchema,
  type SelectedDirectory,
  type SelectedFile,
} from "./types.ts";

const toSelectedFile = (path: string): SelectedFile => {
  const name = basename(path);
  const extension = extname(name).slice(1) || null;

  return selectedFileSchema.parse({
    path,
    name,
    extension,
    directory: dirname(path),
  });
};

const toSelectedDirectory = (path: string): SelectedDirectory =>
  selectedDirectorySchema.parse({
    path,
    name: basename(path),
  });

const toTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
};

export const openFile = async (
  window: BrowserWindow | null | undefined,
  options: unknown,
) => {
  const { filters, title, buttonLabel } = openFileOptionsSchema
    .catch({})
    .parse(options);
  const dialogOptions: OpenDialogOptions = {
    title,
    buttonLabel,
    filters,
    properties: ["openFile"],
  };
  const result = window
    ? await dialog.showOpenDialog(window, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  const path = result.canceled ? null : result.filePaths[0];

  return path ? toSelectedFile(path) : null;
};

export const openDirectory = async (
  window: BrowserWindow | null | undefined,
  options: unknown,
) => {
  const { title, buttonLabel } = openDirectoryOptionsSchema
    .catch({})
    .parse(options);
  const dialogOptions: OpenDialogOptions = {
    title,
    buttonLabel,
    properties: ["openDirectory", "createDirectory"],
  };
  const result = window
    ? await dialog.showOpenDialog(window, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  const path = result.canceled ? null : result.filePaths[0];

  return path ? toSelectedDirectory(path) : null;
};

export const saveGeneratedFile = async (request: unknown) => {
  const { directory, sourceName, contents } =
    saveGeneratedFileRequestSchema.parse(request);
  const { name } = parse(sourceName);
  const nextName = `${name}-${toTimestamp(new Date())}.svm`;
  const path = join(directory, nextName);

  await writeFile(path, contents, "utf-8").catch(() => {
    throw new Error("Unable to save the generated setup file.");
  });

  return saveGeneratedFileResponseSchema.parse({
    path,
    name: nextName,
    directory,
  });
};
