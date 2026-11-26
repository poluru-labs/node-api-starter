# Tool Permissions

Tool permissions. Register agent tools with a risk and scopes, then allow, deny, or require approval for a requested call. The service does not execute the tool.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/tools`

```json
{ "name": "send-email", "risk": "medium", "scopes": ["mail.send"] }
```

`POST /v1/checks`

```json
{ "tool": "send-email", "scopes": ["mail.send"], "maxRisk": "high" }
```

An unknown tool is denied. A requested scope that the tool does not declare is `missing_scope`. A tool risk above `maxRisk` is `risk_exceeded`. A high-risk tool that is otherwise allowed returns `require_approval`. The service records the policy decision and does not call the tool.

`GET /v1/tools/:id` returns the registered tool. A duplicate name is `409`.

## Mock API

Fixture file: `mocks/node-ai-tool-permissions.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                 | Result                      |
| -------- | -------------------- | --------------------------- |
| `GET`    | `/v1/mock/tools`     | List the fixture records    |
| `POST`   | `/v1/mock/tools`     | Add a JSON record           |
| `GET`    | `/v1/mock/tools/:id` | Read one record             |
| `PUT`    | `/v1/mock/tools/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/tools/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/tools/:id` | Remove one record           |

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
docker build --tag node-ai-tool-permissions:local .
docker run --rm -p 3000:3000 node-ai-tool-permissions:local
```

## License

[MIT](LICENSE)
