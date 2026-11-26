# Community Resource Matcher

Community resource matcher. Store resources with needs and an optional region or coordinates. A match request ranks resources that share a need, prefers the same region, and lowers the score by distance.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/resources`

```json
{
  "name": "North Food Bank",
  "needs": ["food"],
  "region": "north",
  "latitude": 44.9,
  "longitude": -93.1
}
```

`POST /v1/matches`

```json
{ "needs": ["food"], "region": "north", "limit": 5 }
```

A resource in a different region is left out when both sides have a region. `limit` defaults to 5 and cannot exceed 20.

`GET /v1/resources/:id` returns one resource.

## Mock API

Fixture file: `mocks/node-ai-community-resource-matcher.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/resources`     | List the fixture records    |
| `POST`   | `/v1/mock/resources`     | Add a JSON record           |
| `GET`    | `/v1/mock/resources/:id` | Read one record             |
| `PUT`    | `/v1/mock/resources/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/resources/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/resources/:id` | Remove one record           |

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
docker build --tag node-ai-community-resource-matcher:local .
docker run --rm -p 3000:3000 node-ai-community-resource-matcher:local
```

## License

[MIT](LICENSE)
