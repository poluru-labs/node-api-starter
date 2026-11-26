# Api Contract Monitor

API contract monitor. Declare the status, required fields, JSON types, and latency budget for an operation. Each observation is checked against that contract. The response body is not retained after the check.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/contracts`

```json
{
  "name": "list-items",
  "method": "GET",
  "path": "/v1/items",
  "expect": {
    "status": 200,
    "required": ["id"],
    "types": { "id": "string", "count": "number" },
    "maxLatencyMs": 300
  }
}
```

`types` values are `string`, `number`, `boolean`, `object`, or `array`. `maxLatencyMs` defaults to 500.

`POST /v1/contracts/:id/observations`

```json
{ "status": 200, "latencyMs": 20, "body": { "id": "item-1", "count": 2 } }
```

Violations use `status_mismatch`, `missing_field`, `type_mismatch`, or `latency_budget`.

`GET /v1/contracts/:id` returns the pass rate, the expectation, and observation history. History keeps the latest 100 checks and does not store the observed body.

## Mock API

Fixture file: `mocks/node-ai-api-contract-monitor.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/contracts`     | List the fixture records    |
| `POST`   | `/v1/mock/contracts`     | Add a JSON record           |
| `GET`    | `/v1/mock/contracts/:id` | Read one record             |
| `PUT`    | `/v1/mock/contracts/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/contracts/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/contracts/:id` | Remove one record           |

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
docker build --tag node-ai-api-contract-monitor:local .
docker run --rm -p 3000:3000 node-ai-api-contract-monitor:local
```

## License

[MIT](LICENSE)
