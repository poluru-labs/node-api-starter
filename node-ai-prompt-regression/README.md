# Prompt Regression

Prompt regression. Save prompt cases with baseline outputs, then compare a new run. Text matches after trimming and collapsing whitespace. JSON objects and arrays match by value, ignoring key order. A missing or unexpected case fails the run.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/suites`

```json
{ "name": "greetings", "cases": [{ "id": "hi", "prompt": "Say hi", "baseline": "hello" }] }
```

`POST /v1/suites/:id/runs`

```json
{ "cases": [{ "id": "hi", "output": "hello" }] }
```

`passRate` is the share of baseline cases that match. `ok` is true only when every result is `match`.

`GET /v1/suites/:id` returns the suite and `latestRun`.

## Mock API

Fixture file: `mocks/node-ai-prompt-regression.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                  | Result                      |
| -------- | --------------------- | --------------------------- |
| `GET`    | `/v1/mock/suites`     | List the fixture records    |
| `POST`   | `/v1/mock/suites`     | Add a JSON record           |
| `GET`    | `/v1/mock/suites/:id` | Read one record             |
| `PUT`    | `/v1/mock/suites/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/suites/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/suites/:id` | Remove one record           |

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
docker build --tag node-ai-prompt-regression:local .
docker run --rm -p 3000:3000 node-ai-prompt-regression:local
```

## License

[MIT](LICENSE)
