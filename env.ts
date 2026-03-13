import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

const defaultHost = "127.0.0.1";
const defaultPort = 5173;

const parsePort = (value?: string) => {
  const port = Number.parseInt(value ?? "", 10);

  return Number.isInteger(port) && port > 0 ? port : defaultPort;
};

const normalizeDevServerHost = (host: string) =>
  host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;

export const host = process.env.HOST?.trim() || defaultHost;
export const port = parsePort(process.env.PORT);
export const devServerUrl = `http://${normalizeDevServerHost(host)}:${port}`;
