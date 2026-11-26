# Evaluation Datasets

Evaluation datasets. Review items for duplicate ids, empty fields, repeated inputs, the same input in two splits, a missing split, a small set, and a classification label under 10 percent. Item text is not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/evaluations`

```json
{
  "name": "qa-v1",
  "task": "question-answering",
  "items": [{ "id": "q1", "input": "What is 2+2?", "expected": "4", "split": "train" }]
}
```

`task` is `classification`, `question-answering`, `extraction`, or `ranking`. `split` is `train`, `validation`, or `test`. When no item has a split, the report recommends 80/10/10. `ok` stays false for duplicates, leakage, empty fields, and mixed missing splits.

`GET /v1/evaluations/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-evaluation-datasets.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                           | Result                      |
| -------- | ------------------------------ | --------------------------- |
| `GET`    | `/v1/mock/dataset-reviews`     | List the fixture records    |
| `POST`   | `/v1/mock/dataset-reviews`     | Add a JSON record           |
| `GET`    | `/v1/mock/dataset-reviews/:id` | Read one record             |
| `PUT`    | `/v1/mock/dataset-reviews/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/dataset-reviews/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/dataset-reviews/:id` | Remove one record           |

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
docker build --tag node-ai-evaluation-datasets:local .
docker run --rm -p 3000:3000 node-ai-evaluation-datasets:local
```

## License

[MIT](LICENSE)
