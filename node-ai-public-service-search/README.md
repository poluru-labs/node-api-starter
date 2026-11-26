# Public Service Search

Public service search. Index services you provide and rank them by overlap with a query. A term in the name counts 3, the category counts 2, and eligibility counts 1. A service in a different area is left out when both sides have an area. This service does not call a government directory.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/services`

```json
{
  "name": "Housing help",
  "agency": "City Housing",
  "category": "housing",
  "area": "north",
  "eligibility": ["rent"],
  "channel": "online"
}
```

`channel` is `online`, `phone`, `office`, or `mail`.

`POST /v1/search`

```json
{ "query": "rent housing", "area": "north", "category": "housing", "limit": 10 }
```

`GET /v1/services/:id` returns one service.

## Mock API

Fixture file: `mocks/node-ai-public-service-search.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/services`     | List the fixture records    |
| `POST`   | `/v1/mock/services`     | Add a JSON record           |
| `GET`    | `/v1/mock/services/:id` | Read one record             |
| `PUT`    | `/v1/mock/services/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/services/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/services/:id` | Remove one record           |

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
docker build --tag node-ai-public-service-search:local .
docker run --rm -p 3000:3000 node-ai-public-service-search:local
```

## License

[MIT](LICENSE)
