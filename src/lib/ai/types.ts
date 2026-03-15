import { z } from "zod";
import { selectedFileSchema } from "../files/types.ts";

export const askAboutFileRequestSchema = z.object({
  file: selectedFileSchema,
  prompt: z.string().trim().min(1),
});

export const askAboutFileResponseSchema = z.object({
  text: z.string(),
  description: z.string().optional(),
  fileContents: z.string().optional(),
  originalFileContents: z.string().optional(),
  parseError: z.string().optional(),
  error: z.string().optional(),
});

export type AskAboutFileRequest = z.infer<typeof askAboutFileRequestSchema>;
export type AskAboutFileResponse = z.infer<typeof askAboutFileResponseSchema>;
