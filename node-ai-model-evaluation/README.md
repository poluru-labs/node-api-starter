# Model Evaluation

Model evaluation. Score labeled predictions. Classification reports accuracy, per-class precision, recall, F1, macro F1, and a confusion list. Regression reports MAE, RMSE, and bias. Rows are not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/evaluations`

```json
{ "task": "classification", "rows": [{ "expected": "cat", "predicted": "cat" }] }
```

`task` may be `regression` with numeric `expected` and `predicted` values. Macro F1 averages the class F1 scores for labels that appear as expected values.

`GET /v1/evaluations/:id` returns the stored metrics.

## Mock API

Fixture file: `mocks/node-ai-model-evaluation.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                        | Result                      |
| -------- | --------------------------- | --------------------------- |
| `GET`    | `/v1/mock/model-scores`     | List the fixture records    |
| `POST`   | `/v1/mock/model-scores`     | Add a JSON record           |
| `GET`    | `/v1/mock/model-scores/:id` | Read one record             |
| `PUT`    | `/v1/mock/model-scores/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/model-scores/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/model-scores/:id` | Remove one record           |

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
docker build --tag node-ai-model-evaluation:local .
docker run --rm -p 3000:3000 node-ai-model-evaluation:local
```

## License

[MIT](LICENSE)
