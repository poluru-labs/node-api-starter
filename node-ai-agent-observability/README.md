# Agent Observability

Agent observability. Record a run, append llm, tool, retrieval, and handoff events, and read a latency and error summary. Attribute keys that look like secrets are stored as `[redacted]`.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/runs` with `{ "agent": "research-agent" }`.

`POST /v1/runs/:id/events`

```json
{
  "kind": "tool",
  "name": "search",
  "status": "ok",
  "durationMs": 40,
  "tokens": 12,
  "complete": true,
  "attributes": { "query": "wcag" }
}
```

`kind` is `llm`, `tool`, `retrieval`, or `handoff`. `status` is `ok` or `error`. An error status keeps the run in `error`. `complete: true` marks a run `completed` when no event has failed.

Attribute names matching secret, token, password, authorization, api key, or credential are redacted.

`GET /v1/runs` lists the latest summaries. `GET /v1/runs/:id` returns the summary and events.

## Mock API

Fixture file: `mocks/node-ai-agent-observability.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                | Result                      |
| -------- | ------------------- | --------------------------- |
| `GET`    | `/v1/mock/runs`     | List the fixture records    |
| `POST`   | `/v1/mock/runs`     | Add a JSON record           |
| `GET`    | `/v1/mock/runs/:id` | Read one record             |
| `PUT`    | `/v1/mock/runs/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/runs/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/runs/:id` | Remove one record           |

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
docker build --tag node-ai-agent-observability:local .
docker run --rm -p 3000:3000 node-ai-agent-observability:local
```

## License

[MIT](LICENSE)
