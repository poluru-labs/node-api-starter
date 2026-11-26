# Energy Forecasting

Energy forecasting. Store a daily series in kWh, kW, or MWh. Fourteen or more points use a 7-day seasonal naive forecast. Shorter series use a straight line. Points far from the median are reported as anomalies.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/series`

```json
{
  "name": "building-a",
  "unit": "kWh",
  "points": [{ "at": "2026-01-01", "value": 10 }]
}
```

Send 3 to 400 daily points. Dates must be unique `YYYY-MM-DD` values.

`POST /v1/series/:id/forecast` with `{ "horizon": 7 }` returns `method`, `mae`, and each future day with `value`, `lower`, and `upper`. `horizon` is 1 to 28.

## Mock API

Fixture file: `mocks/node-ai-energy-forecasting.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                  | Result                      |
| -------- | --------------------- | --------------------------- |
| `GET`    | `/v1/mock/series`     | List the fixture records    |
| `POST`   | `/v1/mock/series`     | Add a JSON record           |
| `GET`    | `/v1/mock/series/:id` | Read one record             |
| `PUT`    | `/v1/mock/series/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/series/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/series/:id` | Remove one record           |

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
docker build --tag node-ai-energy-forecasting:local .
docker run --rm -p 3000:3000 node-ai-energy-forecasting:local
```

## License

[MIT](LICENSE)
