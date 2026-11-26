# Systematic Review

Systematic review. Screen study records against include and exclude terms and return PRISMA-style counts. The service does not search an external library.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/reviews`

```json
{
  "question": "Does the program help adults?",
  "includeTerms": ["randomized", "adults"],
  "excludeTerms": ["mouse"]
}
```

`POST /v1/reviews/:id/studies` accepts `{ "title", "abstract", "year" }`. A study is excluded when any exclude term appears. It is included when every include term appears. A partial match is `maybe`. Anything else is excluded with `missing_terms`.

`GET /v1/reviews/:id` returns the studies and counts for identified, included, excluded, and maybe.

## Mock API

Fixture file: `mocks/node-ai-systematic-review.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                      | Result                      |
| -------- | ------------------------- | --------------------------- |
| `GET`    | `/v1/mock/screenings`     | List the fixture records    |
| `POST`   | `/v1/mock/screenings`     | Add a JSON record           |
| `GET`    | `/v1/mock/screenings/:id` | Read one record             |
| `PUT`    | `/v1/mock/screenings/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/screenings/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/screenings/:id` | Remove one record           |

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
docker build --tag node-ai-systematic-review:local .
docker run --rm -p 3000:3000 node-ai-systematic-review:local
```

## License

[MIT](LICENSE)
