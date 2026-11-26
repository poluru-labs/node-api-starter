# Agent Replay

Agent replay. Store a baseline sequence of tool or model steps, then compare a later run. Object key order does not affect equality.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/replays`

```json
{
  "name": "research",
  "steps": [{ "name": "search", "input": { "q": "wcag" }, "output": { "hits": 2 } }]
}
```

`POST /v1/replays/:id/comparisons` with `{ "steps": [] }` compares that sequence to the baseline.

The comparison has `matched` and `diffs`. A diff names the step `index` and the `field`: `count`, `name`, `input`, or `output`.

`GET /v1/replays/:id` returns the baseline and the latest comparison.

## Mock API

Fixture file: `mocks/node-ai-agent-replay.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                   | Result                      |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/v1/mock/replays`     | List the fixture records    |
| `POST`   | `/v1/mock/replays`     | Add a JSON record           |
| `GET`    | `/v1/mock/replays/:id` | Read one record             |
| `PUT`    | `/v1/mock/replays/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/replays/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/replays/:id` | Remove one record           |

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
docker build --tag node-ai-agent-replay:local .
docker run --rm -p 3000:3000 node-ai-agent-replay:local
```

## License

[MIT](LICENSE)
