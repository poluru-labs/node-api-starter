# AGENTS.md

Instructions for working in this Node.js starter. After the folder is copied for a new service, replace the product-specific sections and keep the engineering rules.

## Product

Water anomaly monitor. Flag negative readings, turbidity above a threshold, sudden spikes, and flat stretches in a local series. It does not connect to a sensor network.

## Goal

Ship a small production-quality Node.js service from this template:

- TypeScript ESM on Node.js 22.18, 24, or 25
- Native type stripping (no ts-node, no tsx)
- `node:test` against the real HTTP server
- Zero runtime dependencies unless the task needs one

## Layout

| Path            | Role                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `src/index.ts`  | Public exports. Starts the process only when this file is the entry point. |
| `src/main.ts`   | Load config, listen, shut down on SIGINT and SIGTERM.                      |
| `src/config.ts` | Read environment variables and fail on invalid values.                     |
| `src/app.ts`    | HTTP handling. Built-in `GET /health` and `GET /ready`.                    |
| `src/server.ts` | Bind `node:http` and close open connections on shutdown.                   |
| `src/logger.ts` | One JSON object per line on stdout.                                        |
| `test/`         | `*.test.ts` files.                                                         |

## Rules

- Relative ESM imports end in `.ts`. `tsc` rewrites them to `.js` in `dist/`.
- Do not add enums, namespaces, or parameter properties. `erasableSyntaxOnly` is on.
- Use `import type` for type-only imports.
- Add routes by passing a `routes` array to `createApp`. Do not replace `/health` or `/ready`.
- Return JSON errors as `{ "error": "<code>" }`. Production responses omit internal messages.
- Put new configuration in `loadConfig` and `.env.example`. Do not commit `.env`.
- Do not log secrets. Do not add a runtime dependency for something `node:` already does.
- Run `npm run check` before handing work back. CI runs format, lint, typecheck, test, build, and a Docker image build.

## Commands

```bash
npm install
npm run dev
npm test
npm run check
```

`npm run dev` loads `.env` when it exists. Tests do not.
