# Disaster Information

Disaster information. Store hazard bulletins and answer a place-and-time query with the active ones plus standard protective actions. Expired bulletins are left out. This service does not fetch a live government feed.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/bulletins`

```json
{
  "event": "flood",
  "severity": "severe",
  "urgency": "immediate",
  "certainty": "observed",
  "area": "north",
  "headline": "River flood warning",
  "instruction": "Move to higher ground.",
  "issuedAt": "2026-11-26T12:00:00Z",
  "expiresAt": "2026-12-01T00:00:00Z"
}
```

Events are `flood`, `wildfire`, `earthquake`, `tornado`, `winter-storm`, and `heat`.

`POST /v1/guidance` with `{ "area": "north", "event": "flood", "at": "2026-11-26T18:00:00Z" }` returns active bulletins and actions. `source` is `bulletin` when one is active, and `standard` otherwise.

`GET /v1/bulletins/:id` returns one bulletin.

## Mock API

Fixture file: `mocks/node-ai-disaster-information.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/bulletins`     | List the fixture records    |
| `POST`   | `/v1/mock/bulletins`     | Add a JSON record           |
| `GET`    | `/v1/mock/bulletins/:id` | Read one record             |
| `PUT`    | `/v1/mock/bulletins/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/bulletins/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/bulletins/:id` | Remove one record           |

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
docker build --tag node-ai-disaster-information:local .
docker run --rm -p 3000:3000 node-ai-disaster-information:local
```

## License

[MIT](LICENSE)
