import {
  askAboutFileRequestSchema,
  askAboutFileResponseSchema,
  type AskAboutFileRequest,
  type AskAboutFileResponse,
} from "./types";

type AiBridge = {
  askAboutFile: (request: AskAboutFileRequest) => Promise<AskAboutFileResponse>;
};

declare global {
  interface Window {
    ai?: AiBridge;
  }
}

const readBridge = () => window.ai;

export const hasAiBridge = () => !!readBridge();

export const askAboutFile = async (request: AskAboutFileRequest) => {
  const parsedRequest = askAboutFileRequestSchema.parse(request);
  const response = await readBridge()?.askAboutFile(parsedRequest);
  const parsedResponse = askAboutFileResponseSchema.parse(response);

  if (parsedResponse.error) {
    throw new Error(parsedResponse.error);
  }

  return parsedResponse;
};
