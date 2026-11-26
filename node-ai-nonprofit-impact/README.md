# Nonprofit Impact

Nonprofit impact. Record a program and its activities, then sum beneficiaries and cost. Cost per beneficiary divides total cost by the sum of activity beneficiaries, so the same person counted twice is counted twice. Activities without an outcome are reported separately.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/programs`

```json
{ "name": "Literacy", "mission": "Help people read." }
```

`POST /v1/programs/:id/activities`

```json
{
  "name": "Classes",
  "output": "20 sessions",
  "outcome": "Reading gains",
  "beneficiaries": 100,
  "costUsd": 500,
  "period": "2026-Q1"
}
```

Omit `outcome` when the activity has an output but no outcome yet.

`GET /v1/programs/:id` returns the program and `impact`, including `beneficiaryMethod` of `sum-of-activities`.

## Mock API

Fixture file: `mocks/node-ai-nonprofit-impact.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/programs`     | List the fixture records    |
| `POST`   | `/v1/mock/programs`     | Add a JSON record           |
| `GET`    | `/v1/mock/programs/:id` | Read one record             |
| `PUT`    | `/v1/mock/programs/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/programs/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/programs/:id` | Remove one record           |

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
docker build --tag node-ai-nonprofit-impact:local .
docker run --rm -p 3000:3000 node-ai-nonprofit-impact:local
```

## License

[MIT](LICENSE)
