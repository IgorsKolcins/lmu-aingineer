import { spawn } from "node:child_process";
import { createServer } from "node:net";
import process from "node:process";
import waitOn from "wait-on";
import { devServerUrl, host, port } from "../env.ts";

const isPortAvailable = () =>
  new Promise<boolean>((resolve) => {
    const server = createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });

const run = async () => {
  if (!(await isPortAvailable())) {
    throw new Error(
      `Port ${port} on ${host} is already in use. Stop the process using it or change PORT in .env.`,
    );
  }

  const vite = spawn(
    "bun",
    ["x", "vite", "--host", host, "--port", `${port}`, "--strictPort"],
    {
      env: process.env,
      stdio: "inherit",
    },
  );

  const stopVite = () => {
    if (!vite.killed) {
      vite.kill("SIGTERM");
    }
  };

  process.on("SIGINT", stopVite);
  process.on("SIGTERM", stopVite);

  vite.on("exit", (code) => {
    if (code && code !== 0) {
      process.exit(code);
    }
  });

  await waitOn({
    resources: [`tcp:${host}:${port}`],
    timeout: 30_000,
  });

  const electron = spawn("bun", ["x", "electron", "."], {
    env: { ...process.env, ELECTRON_RENDERER_URL: devServerUrl },
    stdio: "inherit",
  });

  electron.on("exit", (code) => {
    stopVite();
    process.exit(code ?? 0);
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
