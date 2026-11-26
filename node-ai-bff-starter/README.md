# Bff Starter

BFF starter. Put named JSON resources behind one view so a client can read a screen in a single response. A missing optional part is returned as null with partial true. A missing required part sets ok to false. This service does not call arbitrary upstream URLs.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`PUT /v1/resources/:key` with `{ "data": { "name": "Ada" } }`. Keys are lowercase letters, numbers, and hyphens.

`PUT /v1/views/:name`

```json
{
  "parts": [
    { "key": "profile", "required": true },
    { "key": "alerts", "required": false }
  ]
}
```

`GET /v1/views/:name` returns `ok`, `partial`, `data`, and `errors`.

## Mock API

Fixture file: `mocks/node-ai-bff-starter.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                 | Result                      |
| -------- | -------------------- | --------------------------- |
| `GET`    | `/v1/mock/views`     | List the fixture records    |
| `POST`   | `/v1/mock/views`     | Add a JSON record           |
| `GET`    | `/v1/mock/views/:id` | Read one record             |
| `PUT`    | `/v1/mock/views/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/views/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/views/:id` | Remove one record           |

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
docker build --tag node-ai-bff-starter:local .
docker run --rm -p 3000:3000 node-ai-bff-starter:local
```

## License

[MIT](LICENSE)
