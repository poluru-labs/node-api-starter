# Literature Discovery

Literature discovery. Index papers you provide and rank them by overlap with a query. A term in the title counts 3, a keyword counts 2, and an abstract term counts 1. This service does not call an external library.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/papers`

```json
{
  "title": "Transformers for clinical notes",
  "authors": ["Ada Lovelace"],
  "year": 2024,
  "abstract": "Attention models read clinical notes with transformers.",
  "keywords": ["transformers"],
  "doi": "10.1000/clinical"
}
```

`POST /v1/discover`

```json
{ "query": "clinical transformers", "yearFrom": 2020, "yearTo": 2026, "limit": 10 }
```

`limit` defaults to 10 and cannot exceed 20. Matches with a score of 0 are left out.

`GET /v1/papers/:id` returns one paper.

## Mock API

Fixture file: `mocks/node-ai-literature-discovery.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                  | Result                      |
| -------- | --------------------- | --------------------------- |
| `GET`    | `/v1/mock/papers`     | List the fixture records    |
| `POST`   | `/v1/mock/papers`     | Add a JSON record           |
| `GET`    | `/v1/mock/papers/:id` | Read one record             |
| `PUT`    | `/v1/mock/papers/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/papers/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/papers/:id` | Remove one record           |

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
docker build --tag node-ai-literature-discovery:local .
docker run --rm -p 3000:3000 node-ai-literature-discovery:local
```

## License

[MIT](LICENSE)
