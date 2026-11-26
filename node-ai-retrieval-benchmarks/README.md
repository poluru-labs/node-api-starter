# Retrieval Benchmarks

Retrieval benchmarks. Average precision@k, recall@k, mean reciprocal rank, nDCG@k, and hit rate over labeled rankings. Relevance is binary. nDCG uses log base 2 of rank plus one. Ranked lists are not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/benchmarks`

```json
{
  "name": "bm25",
  "k": 10,
  "queries": [{ "id": "q1", "relevant": ["d1"], "ranked": ["d1", "d2"] }]
}
```

`k` defaults to 10 and cannot exceed 20. Duplicate ranked ids count once, at the first position.

`GET /v1/benchmarks/:id` returns the averaged metrics.

## Mock API

Fixture file: `mocks/node-ai-retrieval-benchmarks.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/retrieval`     | List the fixture records    |
| `POST`   | `/v1/mock/retrieval`     | Add a JSON record           |
| `GET`    | `/v1/mock/retrieval/:id` | Read one record             |
| `PUT`    | `/v1/mock/retrieval/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/retrieval/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/retrieval/:id` | Remove one record           |

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
docker build --tag node-ai-retrieval-benchmarks:local .
docker run --rm -p 3000:3000 node-ai-retrieval-benchmarks:local
```

## License

[MIT](LICENSE)
