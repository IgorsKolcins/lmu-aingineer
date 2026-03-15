# aingineer

To install dependencies:

```bash
bun install
```

Create a local env file:

```bash
cp .env.example .env
```

Supported env vars:

```bash
HOST=127.0.0.1
PORT=5173
```

After the app starts, open Settings and paste your Gemini API key there before
using AI setup generation.

To run in development:

```bash
bun run dev
```

To build the renderer:

```bash
bun run build
```

To build the renderer and Electron main process for production:

```bash
bun run build:app
```

To start Electron against the built app:

```bash
bun run start
```

To build a Windows portable `.exe` on a Windows machine:

```bash
bun run dist:win:portable
```

Windows packaging notes:

- Add a real Windows icon file at `build/icon.ico` before packaging.
- The portable `.exe` is written to `release/`.
- Build the Windows artifact on Windows for the most reliable native module and packaging behavior.

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
