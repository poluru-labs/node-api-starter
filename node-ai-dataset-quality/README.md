# Dataset Quality

Dataset quality. Profile up to 500 object rows: missing values, observed types, uniqueness, numeric outliers, duplicate rows, and violations of an optional string, number, or boolean schema.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/datasets`

```json
{
  "name": "people",
  "schema": { "id": "number", "name": "string" },
  "rows": [{ "id": 1, "name": "Ada" }]
}
```

Empty strings and nulls count as missing and are not type-checked. Duplicate detection uses a stable JSON form of each row. Numeric outliers use a 1.5 IQR fence when a column has at least four numbers.

`GET /v1/datasets/:id` returns the stored report. Row values are not stored.

## Mock API

Fixture file: `mocks/node-ai-dataset-quality.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/datasets`     | List the fixture records    |
| `POST`   | `/v1/mock/datasets`     | Add a JSON record           |
| `GET`    | `/v1/mock/datasets/:id` | Read one record             |
| `PUT`    | `/v1/mock/datasets/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/datasets/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/datasets/:id` | Remove one record           |

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
docker build --tag node-ai-dataset-quality:local .
docker run --rm -p 3000:3000 node-ai-dataset-quality:local
```

## License

[MIT](LICENSE)
