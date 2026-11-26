# Synthetic Data Validator

Synthetic data validator. Check generated rows against declared types, ranges, and categories, and flag duplicate rows and values that look like direct identifiers. Row values are not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/checks`

```json
{
  "fields": [
    { "name": "age", "type": "number", "minimum": 0, "maximum": 120 },
    { "name": "city", "type": "string", "categories": ["north", "south"] }
  ],
  "rows": [{ "age": 30, "city": "north" }]
}
```

Types are `string`, `number`, and `boolean`. Findings are `type_mismatch`, `out_of_range`, `unknown_category`, `sensitive_value`, and `duplicate_row`. A sensitive value looks like an email, an SSN, or a Luhn-valid card number. The stored report keeps codes, not the row values.

`GET /v1/checks/:id` returns that report.

## Mock API

Fixture file: `mocks/node-ai-synthetic-data-validator.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                            | Result                      |
| -------- | ------------------------------- | --------------------------- |
| `GET`    | `/v1/mock/synthetic-checks`     | List the fixture records    |
| `POST`   | `/v1/mock/synthetic-checks`     | Add a JSON record           |
| `GET`    | `/v1/mock/synthetic-checks/:id` | Read one record             |
| `PUT`    | `/v1/mock/synthetic-checks/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/synthetic-checks/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/synthetic-checks/:id` | Remove one record           |

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
docker build --tag node-ai-synthetic-data-validator:local .
docker run --rm -p 3000:3000 node-ai-synthetic-data-validator:local
```

## License

[MIT](LICENSE)
