# Sensitive Data Filter

Sensitive data filter. Detect and redact emails, phone numbers, SSNs, payment card numbers, and secrets before text is logged or sent onward. Findings report the kind and count. The original values are not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/filters`

```json
{ "text": "Contact ada@example.com about card 4111111111111111." }
```

The response replaces each match with `[redacted:email]`, `[redacted:phone]`, `[redacted:ssn]`, `[redacted:card]`, or `[redacted:secret]`. Findings contain the kind and a count. Optional `kinds` limits the detectors. Card numbers are checked with the Luhn test.

`GET /v1/filters/:id` returns the redacted report.

## Mock API

Fixture file: `mocks/node-ai-sensitive-data-filter.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                   | Result                      |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/v1/mock/filters`     | List the fixture records    |
| `POST`   | `/v1/mock/filters`     | Add a JSON record           |
| `GET`    | `/v1/mock/filters/:id` | Read one record             |
| `PUT`    | `/v1/mock/filters/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/filters/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/filters/:id` | Remove one record           |

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
docker build --tag node-ai-sensitive-data-filter:local .
docker run --rm -p 3000:3000 node-ai-sensitive-data-filter:local
```

## License

[MIT](LICENSE)
