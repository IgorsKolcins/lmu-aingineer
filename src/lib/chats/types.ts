import { z } from "zod";
import { selectedFileSchema } from "../files/types.ts";

export const chatRoleSchema = z.enum(["user", "assistant"]);

export const chatSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  file: selectedFileSchema.nullable(),
  fileLocked: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messageCount: z.number().int().nonnegative(),
  lastMessagePreview: z.string().nullable(),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  role: chatRoleSchema,
  text: z.string(),
  description: z.string().optional(),
  fileContents: z.string().optional(),
  baseFileContents: z.string().optional(),
  parseError: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const chatDetailSchema = chatSummarySchema.extend({
  messages: z.array(chatMessageSchema),
});

export const chatStateSnapshotSchema = z.object({
  chats: z.array(chatSummarySchema),
  activeChatId: z.string().min(1).nullable(),
  activeChat: chatDetailSchema.nullable(),
});

export const createChatRequestSchema = z.object({});

export const deleteChatRequestSchema = z.object({
  chatId: z.string().min(1),
});

export const getChatRequestSchema = z.object({
  chatId: z.string().min(1),
});

export const setActiveChatRequestSchema = z.object({
  chatId: z.string().min(1),
});

export const sendChatMessageRequestSchema = z.object({
  chatId: z.string().min(1),
  prompt: z.string().trim().min(1),
  file: selectedFileSchema.optional(),
});

export const sendChatMessageResponseSchema = chatStateSnapshotSchema;

export type ChatSummary = z.infer<typeof chatSummarySchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatDetail = z.infer<typeof chatDetailSchema>;
export type ChatStateSnapshot = z.infer<typeof chatStateSnapshotSchema>;
export type CreateChatRequest = z.infer<typeof createChatRequestSchema>;
export type DeleteChatRequest = z.infer<typeof deleteChatRequestSchema>;
export type GetChatRequest = z.infer<typeof getChatRequestSchema>;
export type SetActiveChatRequest = z.infer<typeof setActiveChatRequestSchema>;
export type SendChatMessageRequest = z.infer<
  typeof sendChatMessageRequestSchema
>;
export type SendChatMessageResponse = z.infer<
  typeof sendChatMessageResponseSchema
>;
