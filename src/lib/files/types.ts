import { z } from "zod";

export const fileDialogFilterSchema = z.object({
  name: z.string().min(1),
  extensions: z.array(z.string().min(1)).min(1),
});

const dialogOptionFields = {
  filters: z.array(fileDialogFilterSchema).optional(),
  title: z.string().min(1).optional(),
  buttonLabel: z.string().min(1).optional(),
} as const;

export const openFileOptionsSchema = z.object(dialogOptionFields);
export const openDirectoryOptionsSchema = z.object({
  title: dialogOptionFields.title,
  buttonLabel: dialogOptionFields.buttonLabel,
});

export const selectedFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  extension: z.string().min(1).nullable(),
  directory: z.string().min(1),
});

export const selectedDirectorySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
});

export const inspectSaveTargetRequestSchema = z.object({
  directory: z.string().min(1),
  fileName: z.string().trim().min(1),
});

export const inspectSaveTargetResponseSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1),
  exists: z.boolean(),
});

export const saveGeneratedFileRequestSchema = z.object({
  directory: z.string().min(1),
  fileName: z.string().trim().min(1),
  contents: z.string(),
});

export const saveGeneratedFileResponseSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  directory: z.string().min(1),
});

export type FileDialogFilter = z.infer<typeof fileDialogFilterSchema>;
export type OpenFileOptions = z.infer<typeof openFileOptionsSchema>;
export type OpenDirectoryOptions = z.infer<typeof openDirectoryOptionsSchema>;
export type SelectedFile = z.infer<typeof selectedFileSchema>;
export type SelectedDirectory = z.infer<typeof selectedDirectorySchema>;
export type InspectSaveTargetRequest = z.infer<
  typeof inspectSaveTargetRequestSchema
>;
export type InspectSaveTargetResponse = z.infer<
  typeof inspectSaveTargetResponseSchema
>;
export type SaveGeneratedFileRequest = z.infer<
  typeof saveGeneratedFileRequestSchema
>;
export type SaveGeneratedFileResponse = z.infer<
  typeof saveGeneratedFileResponseSchema
>;
