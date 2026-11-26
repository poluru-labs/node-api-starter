# Prompt Injection Lab

Prompt injection lab. Scan user, retrieved, or tool text for instruction override, role replacement, requests for hidden instructions, and fake chat delimiters. A high-risk scan returns action block. The submitted text is not stored and is not repeated in the response. This service does not generate attacks.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/scans`

```json
{ "channel": "retrieved", "text": "What is the capital of France?" }
```

`channel` is `user`, `retrieved`, or `tool`. `action` is `allow`, `review`, or `block`.

`GET /v1/scans/:id` returns the rule codes and the action.

## Mock API

Fixture file: `mocks/node-ai-prompt-injection-lab.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                 | Result                      |
| -------- | -------------------- | --------------------------- |
| `GET`    | `/v1/mock/scans`     | List the fixture records    |
| `POST`   | `/v1/mock/scans`     | Add a JSON record           |
| `GET`    | `/v1/mock/scans/:id` | Read one record             |
| `PUT`    | `/v1/mock/scans/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/scans/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/scans/:id` | Remove one record           |

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
docker build --tag node-ai-prompt-injection-lab:local .
docker run --rm -p 3000:3000 node-ai-prompt-injection-lab:local
```

## License

[MIT](LICENSE)
