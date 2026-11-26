# Annotation Review

Annotation review. Collect labels for an item, replace a repeat vote from the same annotator, and report majority, conflicts, pairwise agreement, and corpus Fleiss' kappa.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/tasks`

```json
{ "itemId": "item-1", "allowedLabels": ["yes", "no"] }
```

`POST /v1/tasks/:id/judgments` with `{ "annotatorId": "ada", "label": "yes" }`. A second judgment from the same annotator replaces the first. The label must be one of `allowedLabels`.

The response includes `agreement`: `unanimous`, `majorityLabel` (`null` on a tie), `pairwiseAgreement`, and `conflicts`.

`GET /v1/tasks/:id` returns the task and that agreement.

`GET /v1/agreement` returns Fleiss' kappa across tasks that have at least two judgments.

## Mock API

Fixture file: `mocks/node-ai-annotation-review.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                 | Result                      |
| -------- | -------------------- | --------------------------- |
| `GET`    | `/v1/mock/tasks`     | List the fixture records    |
| `POST`   | `/v1/mock/tasks`     | Add a JSON record           |
| `GET`    | `/v1/mock/tasks/:id` | Read one record             |
| `PUT`    | `/v1/mock/tasks/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/tasks/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/tasks/:id` | Remove one record           |

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
docker build --tag node-ai-annotation-review:local .
docker run --rm -p 3000:3000 node-ai-annotation-review:local
```

## License

[MIT](LICENSE)
