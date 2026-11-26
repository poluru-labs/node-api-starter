# Food Waste Forecasting

Food waste forecasting. Summarize prepared, sold, and wasted amounts by item. A waste rate above 20 percent recommends preparing less. A stockout on at least 30 percent of days recommends preparing more. The suggested amount is the trailing mean of units sold, plus 10 percent.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/kitchens`

```json
{
  "name": "cafe",
  "records": [{ "day": "2026-11-01", "item": "bread", "prepared": 10, "sold": 5, "wasted": 5 }]
}
```

Each day and item pair can appear once. The recommendation uses the latest 7 days for that item. `advice` is `reduce`, `increase`, or `hold`.

`GET /v1/kitchens/:id` returns the stored plan.

## Mock API

Fixture file: `mocks/node-ai-food-waste-forecasting.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/kitchens`     | List the fixture records    |
| `POST`   | `/v1/mock/kitchens`     | Add a JSON record           |
| `GET`    | `/v1/mock/kitchens/:id` | Read one record             |
| `PUT`    | `/v1/mock/kitchens/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/kitchens/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/kitchens/:id` | Remove one record           |

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
docker build --tag node-ai-food-waste-forecasting:local .
docker run --rm -p 3000:3000 node-ai-food-waste-forecasting:local
```

## License

[MIT](LICENSE)
