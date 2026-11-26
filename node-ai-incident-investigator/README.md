# Incident Investigator

Incident investigator. Record a timeline of deploys, alerts, metrics, logs, and notes. The service suggests a recent deploy, an error burst, or more than one service when the timestamps support it. The method is timeline correlation.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/incidents`

```json
{ "title": "Checkout errors", "severity": "sev1", "service": "checkout" }
```

`POST /v1/incidents/:id/events`

```json
{
  "at": "2026-11-26T12:00:00Z",
  "kind": "deploy",
  "message": "Shipped checkout 1.8.0",
  "service": "checkout"
}
```

`kind` is `deploy`, `alert`, `metric`, `log`, or `note`. A deploy within 30 minutes before an alert produces `recent_deploy`. Three or more alerts produce `error_burst`.

`POST /v1/incidents/:id/status` sets `investigating`, `identified`, `monitoring`, or `resolved`.

`GET /v1/incidents/:id` returns the timeline and hypotheses.

## Mock API

Fixture file: `mocks/node-ai-incident-investigator.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/incidents`     | List the fixture records    |
| `POST`   | `/v1/mock/incidents`     | Add a JSON record           |
| `GET`    | `/v1/mock/incidents/:id` | Read one record             |
| `PUT`    | `/v1/mock/incidents/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/incidents/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/incidents/:id` | Remove one record           |

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
docker build --tag node-ai-incident-investigator:local .
docker run --rm -p 3000:3000 node-ai-incident-investigator:local
```

## License

[MIT](LICENSE)
