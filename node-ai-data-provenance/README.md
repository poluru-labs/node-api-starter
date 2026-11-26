# Data Provenance

Data provenance. Record an artifact by content or by SHA-256 digest, then record which artifacts were inputs to a derivation. Lineage walks upstream. A derivation that would create a cycle is rejected.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/artifacts`

```json
{ "name": "raw", "content": "sensor-a" }
```

Send `digest` instead of `content` when the bytes stay outside this service. If both are sent, the digest must equal SHA-256 of the content or the response is `{ "error": "digest_mismatch" }`.

`POST /v1/derivations`

```json
{ "outputId": "<id>", "inputIds": ["<id>"], "operation": "clean" }
```

A cycle returns `{ "error": "cycle" }`.

`GET /v1/artifacts/:id/lineage` returns the artifact and its upstream nodes.

## Mock API

Fixture file: `mocks/node-ai-data-provenance.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/artifacts`     | List the fixture records    |
| `POST`   | `/v1/mock/artifacts`     | Add a JSON record           |
| `GET`    | `/v1/mock/artifacts/:id` | Read one record             |
| `PUT`    | `/v1/mock/artifacts/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/artifacts/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/artifacts/:id` | Remove one record           |

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
docker build --tag node-ai-data-provenance:local .
docker run --rm -p 3000:3000 node-ai-data-provenance:local
```

## License

[MIT](LICENSE)
