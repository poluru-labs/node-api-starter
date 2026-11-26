# Human Approval

Human approval. Queue an agent action for review. Low risk is approved by policy. Medium, high, and critical stay pending until a person approves or rejects them. A critical approval needs a reason. Secret-like payload fields are stored as `[redacted]`.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/requests`

```json
{
  "actor": "mailer",
  "action": "send-email",
  "summary": "Send the invoice",
  "risk": "high",
  "payload": { "note": "invoice 18" }
}
```

`risk` is `low`, `medium`, `high`, or `critical`.

`GET /v1/requests?status=pending` lists the newest 50. `GET /v1/requests/:id` returns one request.

`POST /v1/requests/:id/decisions`

```json
{ "reviewer": "sam", "decision": "approve", "reason": "Customer requested the invoice." }
```

A second decision returns `{ "error": "already_decided" }`. Rejecting, or approving a critical request, requires a reason.

## Mock API

Fixture file: `mocks/node-ai-human-approval.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/requests`     | List the fixture records    |
| `POST`   | `/v1/mock/requests`     | Add a JSON record           |
| `GET`    | `/v1/mock/requests/:id` | Read one record             |
| `PUT`    | `/v1/mock/requests/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/requests/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/requests/:id` | Remove one record           |

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
docker build --tag node-ai-human-approval:local .
docker run --rm -p 3000:3000 node-ai-human-approval:local
```

## License

[MIT](LICENSE)
