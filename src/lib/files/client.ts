import {
  openDirectoryOptionsSchema,
  openFileOptionsSchema,
  saveGeneratedFileRequestSchema,
  saveGeneratedFileResponseSchema,
  selectedDirectorySchema,
  selectedFileSchema,
  type OpenDirectoryOptions,
  type OpenFileOptions,
  type SaveGeneratedFileRequest,
  type SaveGeneratedFileResponse,
  type SelectedDirectory,
  type SelectedFile,
} from "./types.ts";

type FilesBridge = {
  openFile: (options?: OpenFileOptions) => Promise<SelectedFile | null>;
  openDirectory: (
    options?: OpenDirectoryOptions,
  ) => Promise<SelectedDirectory | null>;
  saveGeneratedFile: (
    request: SaveGeneratedFileRequest,
  ) => Promise<SaveGeneratedFileResponse>;
};

declare global {
  interface Window {
    files?: FilesBridge;
  }
}

const readBridge = () => window.files;

export const hasFilesBridge = () => !!readBridge();

export const openFile = async (options: OpenFileOptions = {}) => {
  const parsedOptions = openFileOptionsSchema.parse(options);
  const selection = await readBridge()
    ?.openFile(parsedOptions)
    .catch(() => null);

  return selection ? selectedFileSchema.parse(selection) : null;
};

export const openDirectory = async (options: OpenDirectoryOptions = {}) => {
  const parsedOptions = openDirectoryOptionsSchema.parse(options);
  const selection = await readBridge()
    ?.openDirectory(parsedOptions)
    .catch(() => null);

  return selection ? selectedDirectorySchema.parse(selection) : null;
};

export const saveGeneratedFile = async (request: SaveGeneratedFileRequest) => {
  const parsedRequest = saveGeneratedFileRequestSchema.parse(request);
  const response = await readBridge()?.saveGeneratedFile(parsedRequest);

  return saveGeneratedFileResponseSchema.parse(response);
};
