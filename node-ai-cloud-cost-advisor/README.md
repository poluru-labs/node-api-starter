# Cloud Cost Advisor

Cloud cost advisor. Store hourly USD rates, price a usage submission, and compare it with the previous submission for the same account. Advice covers unknown SKUs, idle quantity, spend spikes, and a single SKU that is at least 60 percent of the total.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/accounts`

```json
{ "name": "prod", "rates": { "cpu.small": 1 } }
```

`POST /v1/accounts/:id/usage`

```json
{ "items": [{ "sku": "cpu.small", "hours": 20, "quantity": 1 }] }
```

`quantity` defaults to 1. A spike is a line that is at least 1.5 times the previous cost for that SKU and at least 10 USD higher.

`GET /v1/accounts/:id` returns the rate-card SKUs and the latest report.

## Mock API

Fixture file: `mocks/node-ai-cloud-cost-advisor.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/accounts`     | List the fixture records    |
| `POST`   | `/v1/mock/accounts`     | Add a JSON record           |
| `GET`    | `/v1/mock/accounts/:id` | Read one record             |
| `PUT`    | `/v1/mock/accounts/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/accounts/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/accounts/:id` | Remove one record           |

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
docker build --tag node-ai-cloud-cost-advisor:local .
docker run --rm -p 3000:3000 node-ai-cloud-cost-advisor:local
```

## License

[MIT](LICENSE)
