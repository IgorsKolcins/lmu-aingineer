import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import {
  buildConversationContents,
  parseStructuredResponse,
  readGeminiApiKey,
  readPlainTextFile,
  requestSetupUpdate,
  toAiError,
} from "../ai/main.ts";
import { selectedFileSchema } from "../files/types.ts";
import {
  chatDetailSchema,
  chatMessageSchema,
  chatStateSnapshotSchema,
  chatSummarySchema,
  createChatRequestSchema,
  deleteChatRequestSchema,
  getChatRequestSchema,
  sendChatMessageRequestSchema,
  setActiveChatRequestSchema,
  updateChatOutputRequestSchema,
} from "./types.ts";
import { getSettings } from "../settings/main.ts";

type ChatRow = {
  id: string;
  title: string;
  file_path: string | null;
  file_name: string | null;
  file_extension: string | null;
  file_directory: string | null;
  file_locked: number;
  output_directory: string | null;
  output_file_name: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string | null;
};

type MessageRow = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  text: string;
  description: string | null;
  file_contents: string | null;
  base_file_contents: string | null;
  parse_error: string | null;
  error: string | null;
  created_at: string;
};

const databaseFileName = "chats.sqlite";
const newChatTitle = "New chat";
const geminiModel = "gemini-2.5-flash";

let database: Database.Database | null = null;

const timestamp = () => new Date().toISOString();

const ensureChatColumn = (
  db: Database.Database,
  name: string,
  definition: string,
) => {
  const existingColumns = db
    .prepare(`PRAGMA table_info(chats)`)
    .all() as Array<{ name: string }>;

  if (existingColumns.some((column) => column.name === name)) {
    return;
  }

  db.exec(`ALTER TABLE chats ADD COLUMN ${name} ${definition}`);
};

const getDatabase = () => {
  if (database) {
    return database;
  }

  const userDataPath = app.getPath("userData");
  mkdirSync(userDataPath, { recursive: true });
  const filePath = join(userDataPath, databaseFileName);
  const nextDatabase = new Database(filePath);

  nextDatabase.pragma("journal_mode = WAL");
  nextDatabase.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_path TEXT,
      file_name TEXT,
      file_extension TEXT,
      file_directory TEXT,
      file_locked INTEGER NOT NULL DEFAULT 0,
      output_directory TEXT,
      output_file_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      text TEXT NOT NULL,
      description TEXT,
      file_contents TEXT,
      base_file_contents TEXT,
      parse_error TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS messages_chat_created_idx
      ON messages(chat_id, created_at, id);

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  ensureChatColumn(nextDatabase, "output_directory", "TEXT");
  ensureChatColumn(nextDatabase, "output_file_name", "TEXT");

  database = nextDatabase;

  return nextDatabase;
};

const toSelectedFile = (
  row: Pick<
    ChatRow,
    "file_path" | "file_name" | "file_extension" | "file_directory"
  >,
) => {
  if (!row.file_path || !row.file_name || !row.file_directory) {
    return null;
  }

  return selectedFileSchema.parse({
    path: row.file_path,
    name: row.file_name,
    extension: row.file_extension,
    directory: row.file_directory,
  });
};

const mapChatSummary = (row: ChatRow) =>
  chatSummarySchema.parse({
    id: row.id,
    title: row.title,
    file: toSelectedFile(row),
    fileLocked: Boolean(row.file_locked),
    outputDirectory: row.output_directory ?? null,
    outputFileName: row.output_file_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
    lastMessagePreview: row.last_message_preview,
  });

const mapChatMessage = (row: MessageRow) =>
  chatMessageSchema.parse({
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    text: row.text,
    description: row.description ?? undefined,
    fileContents: row.file_contents ?? undefined,
    baseFileContents: row.base_file_contents ?? undefined,
    parseError: row.parse_error ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
  });

const selectChatSummaries = () => {
  const db = getDatabase();

  return db
    .prepare(
      `
        SELECT
          chats.id,
          chats.title,
          chats.file_path,
          chats.file_name,
          chats.file_extension,
          chats.file_directory,
          chats.file_locked,
          chats.output_directory,
          chats.output_file_name,
          chats.created_at,
          chats.updated_at,
          COUNT(messages.id) AS message_count,
          (
            SELECT substr(trim(COALESCE(message.description, message.text)), 1, 160)
            FROM messages AS message
            WHERE message.chat_id = chats.id
            ORDER BY message.created_at DESC, message.id DESC
            LIMIT 1
          ) AS last_message_preview
        FROM chats
        LEFT JOIN messages ON messages.chat_id = chats.id
        GROUP BY chats.id
        ORDER BY chats.updated_at DESC, chats.created_at DESC
      `,
    )
    .all() as ChatRow[];
};

const selectChatRow = (chatId: string) => {
  const db = getDatabase();

  return (
    (db
      .prepare(
        `
          SELECT
            chats.id,
            chats.title,
            chats.file_path,
            chats.file_name,
            chats.file_extension,
            chats.file_directory,
            chats.file_locked,
            chats.output_directory,
            chats.output_file_name,
            chats.created_at,
            chats.updated_at,
            COUNT(messages.id) AS message_count,
            (
              SELECT substr(trim(COALESCE(message.description, message.text)), 1, 160)
              FROM messages AS message
              WHERE message.chat_id = chats.id
              ORDER BY message.created_at DESC, message.id DESC
              LIMIT 1
            ) AS last_message_preview
          FROM chats
          LEFT JOIN messages ON messages.chat_id = chats.id
          WHERE chats.id = ?
          GROUP BY chats.id
        `,
      )
      .get(chatId) as ChatRow | undefined) ?? null
  );
};

const selectMessages = (chatId: string) => {
  const db = getDatabase();

  return db
    .prepare(
      `
        SELECT
          id,
          chat_id,
          role,
          text,
          description,
          file_contents,
          base_file_contents,
          parse_error,
          error,
          created_at
        FROM messages
        WHERE chat_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(chatId) as MessageRow[];
};

const readActiveChatId = () => {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT value FROM app_state WHERE key = 'activeChatId'`)
    .get() as { value: string | null } | undefined;

  return row?.value ?? null;
};

const writeActiveChatId = (chatId: string | null) => {
  const db = getDatabase();

  db.prepare(
    `
      INSERT INTO app_state (key, value)
      VALUES ('activeChatId', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(chatId);
};

const getChatDetail = (chatId: string) => {
  const chatRow = selectChatRow(chatId);

  if (!chatRow) {
    return null;
  }

  return chatDetailSchema.parse({
    ...mapChatSummary(chatRow),
    messages: selectMessages(chatId).map(mapChatMessage),
  });
};

const buildSnapshot = (activeChatId = readActiveChatId()) => {
  const chats = selectChatSummaries().map(mapChatSummary);
  const resolvedActiveChatId = chats.some((chat) => chat.id === activeChatId)
    ? activeChatId
    : (chats[0]?.id ?? null);

  if (resolvedActiveChatId !== activeChatId) {
    writeActiveChatId(resolvedActiveChatId);
  }

  return chatStateSnapshotSchema.parse({
    chats,
    activeChatId: resolvedActiveChatId,
    activeChat: resolvedActiveChatId
      ? getChatDetail(resolvedActiveChatId)
      : null,
  });
};

const requireChatDetail = (chatId: string) => {
  const chat = getChatDetail(chatId);

  if (!chat) {
    throw new Error("Chat not found.");
  }

  return chat;
};

const getWorkingFileContents = async (
  chat: ReturnType<typeof requireChatDetail>,
  file?: {
    path: string;
    name: string;
    extension: string | null;
    directory: string;
  },
) => {
  const latestGeneratedFile = [...chat.messages]
    .reverse()
    .find((message) => message.fileContents)?.fileContents;

  if (latestGeneratedFile) {
    return latestGeneratedFile;
  }

  const latestBaseFile = [...chat.messages]
    .reverse()
    .find((message) => message.baseFileContents)?.baseFileContents;

  if (latestBaseFile) {
    return latestBaseFile;
  }

  const selectedFile = file ?? chat.file;

  if (!selectedFile) {
    throw new Error("Select a `.svm` file before sending a message.");
  }

  return readPlainTextFile(selectedFile.path);
};

const insertMessage = (
  db: Database.Database,
  message: {
    id: string;
    chatId: string;
    role: "user" | "assistant";
    text: string;
    description?: string;
    fileContents?: string;
    baseFileContents?: string;
    parseError?: string;
    error?: string;
    createdAt: string;
  },
) => {
  db.prepare(
    `
      INSERT INTO messages (
        id,
        chat_id,
        role,
        text,
        description,
        file_contents,
        base_file_contents,
        parse_error,
        error,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    message.id,
    message.chatId,
    message.role,
    message.text,
    message.description ?? null,
    message.fileContents ?? null,
    message.baseFileContents ?? null,
    message.parseError ?? null,
    message.error ?? null,
    message.createdAt,
  );
};

export const listChats = async () => buildSnapshot();

export const createChat = async (request: unknown) => {
  createChatRequestSchema.parse(request);

  const db = getDatabase();
  const id = randomUUID();
  const createdAt = timestamp();
  const { fileSaveFolder } = getSettings();

  db.prepare(
    `
      INSERT INTO chats (
        id,
        title,
        file_path,
        file_name,
        file_extension,
        file_directory,
        file_locked,
        output_directory,
        output_file_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, NULL, NULL, NULL, NULL, 0, ?, NULL, ?, ?)
    `,
  ).run(id, newChatTitle, fileSaveFolder, createdAt, createdAt);

  writeActiveChatId(id);

  return buildSnapshot(id);
};

export const getChat = async (request: unknown) => {
  const { chatId } = getChatRequestSchema.parse(request);

  return chatStateSnapshotSchema.parse({
    ...buildSnapshot(chatId),
    activeChatId: chatId,
    activeChat: getChatDetail(chatId),
  });
};

export const setActiveChat = async (request: unknown) => {
  const { chatId } = setActiveChatRequestSchema.parse(request);
  requireChatDetail(chatId);
  writeActiveChatId(chatId);

  return buildSnapshot(chatId);
};

export const updateChatOutput = async (request: unknown) => {
  const { chatId, outputDirectory, outputFileName } =
    updateChatOutputRequestSchema.parse(request);
  const chat = requireChatDetail(chatId);
  const db = getDatabase();

  db.prepare(
    `
      UPDATE chats
      SET
        output_directory = ?,
        output_file_name = ?
      WHERE id = ?
    `,
  ).run(
    outputDirectory === undefined ? chat.outputDirectory : outputDirectory,
    outputFileName === undefined ? chat.outputFileName : outputFileName,
    chatId,
  );

  writeActiveChatId(chatId);

  return buildSnapshot(chatId);
};

export const deleteChat = async (request: unknown) => {
  const { chatId } = deleteChatRequestSchema.parse(request);
  const db = getDatabase();

  db.prepare(`DELETE FROM chats WHERE id = ?`).run(chatId);

  const nextActiveChatId = selectChatSummaries()[0]?.id ?? null;
  writeActiveChatId(nextActiveChatId);

  return buildSnapshot(nextActiveChatId);
};

export const sendChatMessage = async (request: unknown) => {
  const { chatId, prompt, file } = sendChatMessageRequestSchema.parse(request);
  const chat = requireChatDetail(chatId);
  const selectedFile = file ?? chat.file;

  if (!selectedFile) {
    throw new Error("Select a `.svm` file before sending a message.");
  }

  if (chat.fileLocked && file && chat.file && file.path !== chat.file.path) {
    throw new Error("The selected file is locked for this chat.");
  }

  const baseFileContents = await getWorkingFileContents(chat, selectedFile);
  const userMessageId = randomUUID();
  const assistantMessageId = randomUUID();
  const userCreatedAt = timestamp();
  const apiKey = readGeminiApiKey();
  const db = getDatabase();

  db.transaction(() => {
    insertMessage(db, {
      id: userMessageId,
      chatId,
      role: "user",
      text: prompt,
      createdAt: userCreatedAt,
    });

    db.prepare(
      `
        UPDATE chats
        SET
          title = ?,
          file_path = ?,
          file_name = ?,
          file_extension = ?,
          file_directory = ?,
          file_locked = 1,
          updated_at = ?
        WHERE id = ?
      `,
    ).run(
      chat.fileLocked ? chat.title : selectedFile.name,
      selectedFile.path,
      selectedFile.name,
      selectedFile.extension,
      selectedFile.directory,
      userCreatedAt,
      chatId,
    );

    writeActiveChatId(chatId);
  })();

  let assistantMessage: {
    text: string;
    description?: string;
    fileContents?: string;
    parseError?: string;
    error?: string;
  };

  try {
    const aiResponse = await requestSetupUpdate({
      apiKey,
      model: geminiModel,
      contents: buildConversationContents({
        file: selectedFile,
        prompt,
        workingFileContents: baseFileContents,
        messages: chat.messages,
      }),
    }).catch((error) => {
      throw toAiError(error);
    });
    const text = aiResponse.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsedResponse = parseStructuredResponse(text);

    assistantMessage = {
      text,
      description: parsedResponse.description,
      fileContents: parsedResponse.fileContents,
      parseError: parsedResponse.parseError,
    };
  } catch (error) {
    assistantMessage = {
      text: "",
      error:
        error instanceof Error
          ? error.message
          : "Unable to get a response from Gemini.",
    };
  }

  const assistantCreatedAt = timestamp();
  const tx = db.transaction(() => {
    insertMessage(db, {
      id: assistantMessageId,
      chatId,
      role: "assistant",
      text: assistantMessage.text,
      description: assistantMessage.description,
      fileContents: assistantMessage.fileContents,
      baseFileContents,
      parseError: assistantMessage.parseError,
      error: assistantMessage.error,
      createdAt: assistantCreatedAt,
    });

    db.prepare(
      `
        UPDATE chats
        SET
          title = ?,
          file_path = ?,
          file_name = ?,
          file_extension = ?,
          file_directory = ?,
          file_locked = 1,
          updated_at = ?
        WHERE id = ?
      `,
    ).run(
      chat.fileLocked ? chat.title : selectedFile.name,
      selectedFile.path,
      selectedFile.name,
      selectedFile.extension,
      selectedFile.directory,
      assistantCreatedAt,
      chatId,
    );

    writeActiveChatId(chatId);
  });

  tx();

  return buildSnapshot(chatId);
};
