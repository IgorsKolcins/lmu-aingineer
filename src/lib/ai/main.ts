import { readFile } from "node:fs/promises";
import { GoogleGenAI, type Content } from "@google/genai";
import type { ChatMessage } from "../chats/types.ts";
import { getSettings } from "../settings/main.ts";

const binaryByteLimit = 8_000;
const binaryCharacter = 0;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const systemInstruction = `You are editing a Le Mans Ultimate car setup file with the .svm extension.
Apply the user's requested setup changes directly to the full file contents.
Return a very structured response using this exact shape:

Description of the changes
- <setting name> changed: <old value> > <new value>. <what this changes in the car and how it will affect the driving>
<<<FILE
<full updated .svm file contents>
FILE

Rules:
- Return exactly one file block.
- The file block must contain the complete updated .svm file, not a patch or partial snippet.
- Do not add commentary after the closing FILE marker.
- Preserve existing values unless the requested change requires an update.
- In the description section, use plain text only.
- Every bullet in the description section must start with "- ".
- Mention every individual changed line or value from the file in its own bullet.
- Do not group multiple file changes into one bullet if that would hide an individual changed line or value.
- Each bullet must include the setting name, the previous value, the new value, and the practical handling or driving effect of that exact change.
- Do not mention unchanged values in the description.`;

export const readGeminiApiKey = () => {
  const apiKey = getSettings().geminiApiKey;

  if (!apiKey) {
    throw new Error("Add your Gemini API key in Settings before generating.");
  }

  return apiKey;
};

const assertTextFile = (buffer: Buffer) => {
  if (buffer.subarray(0, binaryByteLimit).includes(binaryCharacter)) {
    throw new Error("The selected file could not be read as plain text.");
  }
};

export const readPlainTextFile = async (path: string) => {
  let fileBuffer: Buffer;

  try {
    fileBuffer = await readFile(path);
  } catch {
    throw new Error("The selected file could not be read.");
  }

  assertTextFile(fileBuffer);

  try {
    return textDecoder.decode(fileBuffer);
  } catch {
    throw new Error("The selected file is not valid UTF-8 plain text.");
  }
};

const fileBlockPattern = /^<<<FILE\s*\n([\s\S]*?)\nFILE\s*$/m;

export const parseStructuredResponse = (text: string) => {
  const matches = [...text.matchAll(/<<<FILE\s*\n[\s\S]*?\nFILE\s*/gm)];

  if (matches.length === 0) {
    return {
      description: text,
      parseError:
        "Gemini did not include a valid setup file block. Ask it to return the full `.svm` contents inside `<<<FILE` and `FILE`.",
    };
  }

  if (matches.length > 1) {
    return {
      description: text.replace(/<<<FILE\s*\n[\s\S]*?\nFILE\s*/gm, "").trim(),
      parseError:
        "Gemini returned multiple setup file blocks. Ask it to return exactly one full `.svm` file.",
    };
  }

  const fileMatch = text.match(fileBlockPattern);

  if (!fileMatch) {
    return {
      description: text.replace(/<<<FILE[\s\S]*/m, "").trim() || text,
      parseError:
        "Gemini returned a malformed setup file block. Ask it to wrap the full `.svm` file between `<<<FILE` and `FILE`.",
    };
  }

  const description = text.replace(fileBlockPattern, "").trim();

  return {
    description: description || "Updated setup generated.",
    fileContents: fileMatch[1],
  };
};

const buildPrompt = ({
  prompt,
  file,
  workingFileContents,
}: {
  prompt: string;
  file: { name: string; path: string };
  workingFileContents: string;
}) => `User request:
${prompt}

Target file name: ${file.name}
Target file path: ${file.path}

Current working file contents:
<<<FILE
${workingFileContents}
FILE`;

export const buildConversationContents = ({
  file,
  prompt,
  workingFileContents,
  messages,
}: {
  file: { name: string; path: string };
  prompt: string;
  workingFileContents: string;
  messages: ChatMessage[];
}) => {
  const history = messages.reduce<Content[]>((accumulator, message) => {
    if (message.role === "assistant" && message.error) {
      return accumulator;
    }

    accumulator.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text }],
    });

    return accumulator;
  }, []);

  return [
    ...history,
    {
      role: "user",
      parts: [
        {
          text: buildPrompt({
            prompt,
            file,
            workingFileContents,
          }),
        },
      ],
    },
  ];
};

const parseRetryDelaySeconds = (error: unknown) => {
  if (!error || typeof error !== "object" || !("details" in error)) {
    return null;
  }

  const { details } = error;

  if (!Array.isArray(details)) {
    return null;
  }

  const retryInfo = details.find(
    (detail) =>
      detail &&
      typeof detail === "object" &&
      detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo" &&
      typeof detail.retryDelay === "string",
  );

  if (!retryInfo) {
    return null;
  }

  const seconds = Number.parseInt(retryInfo.retryDelay, 10);

  return Number.isFinite(seconds) ? seconds : null;
};

export const toAiError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return new Error("Unable to get a response from Gemini.");
  }

  const status = "status" in error ? error.status : null;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const retryDelaySeconds = parseRetryDelaySeconds(error);
  const hasQuotaError =
    status === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded");

  if (hasQuotaError) {
    const retryMessage = retryDelaySeconds
      ? ` Please wait about ${retryDelaySeconds} seconds and try again.`
      : " Please try again shortly.";

    return new Error(
      `Gemini quota is currently exhausted for this API key.${retryMessage}`,
    );
  }

  if (status === 401 || status === 403) {
    return new Error(
      "Gemini rejected the API key. Check the key in Settings and confirm billing access.",
    );
  }

  if (message) {
    return new Error(`Gemini request failed: ${message}`);
  }

  return new Error("Unable to get a response from Gemini.");
};

export const requestSetupUpdate = ({
  apiKey,
  model,
  contents,
}: {
  apiKey: string;
  model: string;
  contents: Content[];
}) => {
  const ai = new GoogleGenAI({ apiKey });

  return ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.3,
    },
  });
};
