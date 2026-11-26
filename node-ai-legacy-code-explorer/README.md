# Legacy Code Explorer

Legacy code explorer. Scan submitted files for files over 400 lines, functions over 80 lines, brace depth of 6 or more, TODO or FIXME notes, goto, and import or require dependencies. The scan is lexical and does not execute the code. File contents are not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/explorations`

```json
{ "files": [{ "path": "src/app.js", "content": "const fs = require('fs');\n" }] }
```

Paths must be relative and must not contain `..`. Up to 20 files can be sent.

`GET /v1/explorations/:id` returns dependencies and findings.

## Mock API

Fixture file: `mocks/node-ai-legacy-code-explorer.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                        | Result                      |
| -------- | --------------------------- | --------------------------- |
| `GET`    | `/v1/mock/explorations`     | List the fixture records    |
| `POST`   | `/v1/mock/explorations`     | Add a JSON record           |
| `GET`    | `/v1/mock/explorations/:id` | Read one record             |
| `PUT`    | `/v1/mock/explorations/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/explorations/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/explorations/:id` | Remove one record           |

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
docker build --tag node-ai-legacy-code-explorer:local .
docker run --rm -p 3000:3000 node-ai-legacy-code-explorer:local
```

## License

[MIT](LICENSE)
