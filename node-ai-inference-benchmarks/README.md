# Inference Benchmarks

Inference benchmarks. Summarize successful-request latency percentiles, output tokens per second, and success rate. Percentiles use linear interpolation. A run fails its objective when p95 is above the latency limit or the success rate is below the reliability limit.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/benchmarks`

```json
{
  "model": "small-v1",
  "slo": { "maxP95Ms": 500, "minSuccessRate": 0.99 },
  "samples": [{ "latencyMs": 80, "tokensIn": 20, "tokensOut": 40, "success": true }]
}
```

`slo` defaults to 500 ms p95 and a 0.99 success rate. Latency percentiles and tokens per second use successful samples only. Samples are not stored.

`GET /v1/benchmarks/:id` returns the summary.

## Mock API

Fixture file: `mocks/node-ai-inference-benchmarks.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/inference`     | List the fixture records    |
| `POST`   | `/v1/mock/inference`     | Add a JSON record           |
| `GET`    | `/v1/mock/inference/:id` | Read one record             |
| `PUT`    | `/v1/mock/inference/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/inference/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/inference/:id` | Remove one record           |

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
docker build --tag node-ai-inference-benchmarks:local .
docker run --rm -p 3000:3000 node-ai-inference-benchmarks:local
```

## License

[MIT](LICENSE)
