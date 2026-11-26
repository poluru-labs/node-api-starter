# Contributing

This repository is the base Node.js starter. Copy it when starting a new service, then change the package name, service name, and routes.

## Before you open a pull request

From a clean install:

```bash
npm ci
npm run check
```

`npm run check` is format, lint, types, tests, and the production build.

## Project conventions

- ESM only. Relative import specifiers end in `.ts`. The build rewrites them to `.js`.
- Keep TypeScript erasable: no enums, namespaces, or parameter properties. Node runs the source directly.
- Use `import type` for type-only imports.
- Prefer the Node.js standard library. Add a dependency when the standard library becomes the awkward option.
- Configuration comes from the environment. Update `.env.example` when you add a variable. Do not commit `.env`.
- Return JSON errors as `{ "error": "<code>" }`. Do not put secrets or stack traces in responses.
- Logs are single-line JSON on stdout. Do not log secrets.
- `/health` reports that the process is up. `/ready` reports that it should receive traffic.
