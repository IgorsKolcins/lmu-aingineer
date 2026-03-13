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

To run in development:

```bash
bun run dev
```

To build the renderer:

```bash
bun run build
```

To start Electron against the built app:

```bash
bun run start
```

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
