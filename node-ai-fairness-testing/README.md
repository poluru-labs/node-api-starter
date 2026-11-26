# Fairness Testing

Fairness testing. Compare binary predictions across groups. The report includes selection rate, base rate, true positive rate, false positive rate, the four-fifths ratio, and the equal-opportunity gap. A group under 30 rows is marked unreliable.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/assessments`

```json
{
  "protectedAttribute": "group",
  "rows": [{ "group": "a", "label": 1, "prediction": 1 }]
}
```

`label` and `prediction` are `0` or `1`. `disparateImpact` is the smallest selection rate divided by the largest. Below `0.8` fails the four-fifths rule. `equalOpportunityGap` above `0.1` is also a finding. `ok` requires two groups of at least 30 rows and neither of those gaps.

`GET /v1/assessments/:id` returns the stored report. Individual rows are not stored.

## Mock API

Fixture file: `mocks/node-ai-fairness-testing.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/fairness`     | List the fixture records    |
| `POST`   | `/v1/mock/fairness`     | Add a JSON record           |
| `GET`    | `/v1/mock/fairness/:id` | Read one record             |
| `PUT`    | `/v1/mock/fairness/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/fairness/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/fairness/:id` | Remove one record           |

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
docker build --tag node-ai-fairness-testing:local .
docker run --rm -p 3000:3000 node-ai-fairness-testing:local
```

## License

[MIT](LICENSE)
