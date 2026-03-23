# LeMans Ultimate AIngineer (alpha)

This app allows you to select an existing LMU car setup file (.svm) and ask the AI to make changes to it.

App uses Google Gemini 2.5 Flash in a free plan.

> [!WARNING]  
> You must create a new API key in [Google AI Studio](https://aistudio.google.com/api-keys)

### Install Windows .exe

1. Download the latest release from: [Releases](https://github.com/IgorsKolcins/lmu-aingineer/releases)
2. Create a new API key in [Google AI Studio](https://aistudio.google.com/api-keys)
3. Open .exe file
4. Go to the settings and enter your API key

## For developers

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

To build a Windows x64 portable `.exe`:

```bash
bun run dist:win:portable
```

Windows packaging notes:

- Add a real Windows icon file at `build/icon.ico` before packaging.
- The portable `.exe` is written to `release/`.
- `bun run dist:win:portable` explicitly targets Windows `x64`, even when run on Apple Silicon.
- Build the Windows artifact on Windows for the most reliable native module and packaging behavior.

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
