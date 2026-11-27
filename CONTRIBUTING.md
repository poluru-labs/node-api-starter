# Contributing

This repository is a catalog of small TypeScript JSON APIs. Each `node-ai-*` folder is its own service, with its own `package.json`, README, tests, and fixture file. Changes belong in the folder they affect.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Before you open a pull request

Work inside the service you changed:

```bash
cd node-ai-<service>
npm ci
npm run check
```

`npm run check` runs format, lint, types, tests, and the production build. CI runs the same checks for that folder.

## Project conventions

- ESM only. Relative import specifiers end in `.ts`. The build rewrites them to `.js`.
- Keep TypeScript erasable: no enums, namespaces, or parameter properties. Node runs the source directly.
- Use `import type` for type-only imports.
- Prefer the Node.js standard library. Add a dependency when the standard library becomes the awkward option.
- Configuration comes from the environment. Update `.env.example` when you add a variable. Do not commit `.env`.
- Return JSON errors as `{ "error": "<code>" }`. Leave secrets and stack traces out of responses.
- Logs are single-line JSON on stdout. Leave secrets out of logs.
- `/health` reports that the process is up. `/ready` reports that it should receive traffic.
- Describe a new or changed route in that folder's README, and keep the root [README](README.md) catalog in step when you add or rename a service.

## Security

Report vulnerabilities through private GitHub advisories. See [SECURITY.md](SECURITY.md). Do not open a public issue for a security problem.
