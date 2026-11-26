# Research Artifact Index

Research artifact index. Store papers, datasets, code, models, and protocols, then link them with cites, uses, or derives. Search matches title terms. URLs are not fetched.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/artifacts`

```json
{
  "kind": "paper",
  "title": "Climate dataset notes",
  "version": "1.0.0",
  "license": "CC-BY-4.0",
  "identifier": "10.1000/climate",
  "summary": "Notes that describe the climate measurements."
}
```

`kind` is `paper`, `dataset`, `code`, `model`, or `protocol`. Licenses are `MIT`, `Apache-2.0`, `CC-BY-4.0`, `CC0-1.0`, and `other`.

`POST /v1/artifacts/:id/relations` with `{ "type": "uses", "targetId": "<id>" }`. An unknown target returns `{ "error": "unknown_target" }`.

`POST /v1/search` with `{ "query": "climate", "kind": "paper" }`. `GET /v1/artifacts/:id` returns one artifact.

## Mock API

Fixture file: `mocks/node-ai-research-artifact-index.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                              | Result                      |
| -------- | --------------------------------- | --------------------------- |
| `GET`    | `/v1/mock/research-artifacts`     | List the fixture records    |
| `POST`   | `/v1/mock/research-artifacts`     | Add a JSON record           |
| `GET`    | `/v1/mock/research-artifacts/:id` | Read one record             |
| `PUT`    | `/v1/mock/research-artifacts/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/research-artifacts/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/research-artifacts/:id` | Remove one record           |

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
docker build --tag node-ai-research-artifact-index:local .
docker run --rm -p 3000:3000 node-ai-research-artifact-index:local
```

## License

[MIT](LICENSE)
