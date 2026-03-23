import { access, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { dialog, type BrowserWindow, type OpenDialogOptions } from "electron";
import {
  inspectSaveTargetRequestSchema,
  inspectSaveTargetResponseSchema,
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

const normalizeSaveFileName = (value: string) => {
  const trimmedValue = value.trim();

  return extname(trimmedValue).toLowerCase() === ".svm"
    ? trimmedValue
    : `${trimmedValue}.svm`;
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

export const inspectSaveTarget = async (request: unknown) => {
  const { directory, fileName } = inspectSaveTargetRequestSchema.parse(request);
  const normalizedFileName = normalizeSaveFileName(fileName);
  const path = join(directory, normalizedFileName);
  const exists = await access(path)
    .then(() => true)
    .catch(() => false);

  return inspectSaveTargetResponseSchema.parse({
    path,
    fileName: normalizedFileName,
    exists,
  });
};

export const saveGeneratedFile = async (request: unknown) => {
  const { directory, fileName, contents } =
    saveGeneratedFileRequestSchema.parse(request);
  const normalizedFileName = normalizeSaveFileName(fileName);
  const path = join(directory, normalizedFileName);

  await writeFile(path, contents, "utf-8").catch(() => {
    throw new Error("Unable to save the generated setup file.");
  });

  return saveGeneratedFileResponseSchema.parse({
    path,
    name: normalizedFileName,
    directory,
  });
};
