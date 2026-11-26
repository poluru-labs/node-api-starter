# Water Anomaly Monitor

Water anomaly monitor. Flag negative readings, turbidity above a threshold, sudden spikes, and flat stretches in a local series. It does not connect to a sensor network.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/monitors`

```json
{ "name": "Intake", "metric": "turbidity", "unit": "NTU" }
```

Metrics are `flow`, `turbidity`, and `level`. Turbidity defaults to a threshold of 5. `POST /v1/monitors/:id/readings` accepts up to 400 `{ "at", "value" }` points. A value below zero is `negative`. Turbidity above the threshold is `threshold`. A jump to at least three times the previous positive value is `spike`. Four identical readings in a row are `flatline`.

`GET /v1/monitors/:id` returns the monitor.

## Mock API

Fixture file: `mocks/node-ai-water-anomaly-monitor.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/monitors`     | List the fixture records    |
| `POST`   | `/v1/mock/monitors`     | Add a JSON record           |
| `GET`    | `/v1/mock/monitors/:id` | Read one record             |
| `PUT`    | `/v1/mock/monitors/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/monitors/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/monitors/:id` | Remove one record           |

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
docker build --tag node-ai-water-anomaly-monitor:local .
docker run --rm -p 3000:3000 node-ai-water-anomaly-monitor:local
```

## License

[MIT](LICENSE)
