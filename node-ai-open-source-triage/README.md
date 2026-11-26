# Open Source Triage

Open source triage. Classify an issue or pull request as needs-info, ready, a small documentation change, or a security report. Similar titles are attached with a token overlap score. Security reports are marked for private disclosure, and the body is not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/items`

```json
{
  "kind": "issue",
  "title": "App crash on save",
  "body": "it breaks",
  "hasReproduction": false
}
```

`kind` is `issue` or `pull`. A bug report without reproduction steps is `needs-info`. A short typo or docs title is `good-first-issue`. A title or body that names a CVE, vulnerability, or RCE is `security` with priority `urgent`.

`GET /v1/items?queue=needs-info` lists the newest 50. `GET /v1/items/:id` returns one decision.

## Mock API

Fixture file: `mocks/node-ai-open-source-triage.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                 | Result                      |
| -------- | -------------------- | --------------------------- |
| `GET`    | `/v1/mock/items`     | List the fixture records    |
| `POST`   | `/v1/mock/items`     | Add a JSON record           |
| `GET`    | `/v1/mock/items/:id` | Read one record             |
| `PUT`    | `/v1/mock/items/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/items/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/items/:id` | Remove one record           |

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
docker build --tag node-ai-open-source-triage:local .
docker run --rm -p 3000:3000 node-ai-open-source-triage:local
```

## License

[MIT](LICENSE)
