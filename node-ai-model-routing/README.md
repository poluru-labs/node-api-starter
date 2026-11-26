# Model Routing

Model routing. Register model cards and choose the cheapest one that has the requested capabilities, accepts sensitive input when required, and stays inside the cost and latency caps. Ties break toward lower latency, then name. This service does not call a model.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/models`

```json
{
  "name": "small-summarizer",
  "tier": "small",
  "costPer1kTokens": 0.1,
  "maxLatencyMs": 200,
  "capabilities": ["summarize"],
  "allowsSensitive": false
}
```

`tier` is `small` or `large`. A repeated name returns `{ "error": "duplicate_model" }`.

`POST /v1/routes`

```json
{ "task": "summarize", "needs": ["summarize"], "sensitive": false, "maxLatencyMs": 500 }
```

`matched` is null and `reason` is `no_match` when no card fits.

`GET /v1/models/:id` returns one card.

## Mock API

Fixture file: `mocks/node-ai-model-routing.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                  | Result                      |
| -------- | --------------------- | --------------------------- |
| `GET`    | `/v1/mock/models`     | List the fixture records    |
| `POST`   | `/v1/mock/models`     | Add a JSON record           |
| `GET`    | `/v1/mock/models/:id` | Read one record             |
| `PUT`    | `/v1/mock/models/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/models/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/models/:id` | Remove one record           |

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
docker build --tag node-ai-model-routing:local .
docker run --rm -p 3000:3000 node-ai-model-routing:local
```

## License

[MIT](LICENSE)
