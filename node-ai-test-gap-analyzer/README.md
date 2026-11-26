# Test Gap Analyzer

Test gap analyzer. Compare source files with test files and report functions whose names never appear in a test. File contents are not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/analyses`

```json
{
  "files": [
    { "path": "src/app.ts", "content": "export function greet() { return 1; }" },
    { "path": "test/app.test.ts", "content": "greet();" }
  ]
}
```

Paths are relative and cannot contain `..`. A file is a test when its name ends in `.test.*` or `_test.*`, starts with `test/`, or sits in `__tests__`. Functions are the names after `function`, `def`, or `func`. Coverage is the share of source functions named in any test file. The stored report keeps names and paths, not file contents.

`GET /v1/analyses/:id` returns the gaps.

## Mock API

Fixture file: `mocks/node-ai-test-gap-analyzer.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/analyses`     | List the fixture records    |
| `POST`   | `/v1/mock/analyses`     | Add a JSON record           |
| `GET`    | `/v1/mock/analyses/:id` | Read one record             |
| `PUT`    | `/v1/mock/analyses/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/analyses/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/analyses/:id` | Remove one record           |

A repeated `id` on `POST` returns `409` with `{ "error": "duplicate" }`. An unknown `id` returns `404` with `{ "error": "not_found" }`.

## Scripts

```bash
npm install
cp .env.example .env
npm run dev
npm test
npm run check
```

`npm run dev` and `npm start` load `.env` when it exists. Tests do not. `GET /health` and `GET /ready` stay available for process checks.

Node `22` is recorded in `.nvmrc`. `package.json` also allows Node `^24` and `^25`.

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The same steps run in `.github/workflows/ci.yml` on Node 22 and 24. A second job builds the Docker image.

## Container

```bash
docker build --tag node-ai-test-gap-analyzer:local .
docker run --rm -p 3000:3000 node-ai-test-gap-analyzer:local
```

## License

[MIT](LICENSE)
