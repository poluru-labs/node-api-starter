# Research Reproducibility

Research reproducibility. Score a study for data, code, a pinned environment, a seed, a command, hardware notes, and a license. The badge is reusable at 80 points when data, code, environment, command, and license are present. It is functional at 40 points when code and a command are present.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/studies`

```json
{
  "title": "Pinned climate rerun",
  "data": true,
  "code": true,
  "environment": "lockfile",
  "seed": true,
  "command": true,
  "hardware": true,
  "license": true
}
```

`environment` is `lockfile`, `container`, or `none`. Weights are data 20, code 20, environment 20, seed 10, command 15, hardware 5, and license 10.

`GET /v1/studies/:id` returns the score, badge, and checks.

## Mock API

Fixture file: `mocks/node-ai-research-reproducibility.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                   | Result                      |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/v1/mock/studies`     | List the fixture records    |
| `POST`   | `/v1/mock/studies`     | Add a JSON record           |
| `GET`    | `/v1/mock/studies/:id` | Read one record             |
| `PUT`    | `/v1/mock/studies/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/studies/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/studies/:id` | Remove one record           |

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
docker build --tag node-ai-research-reproducibility:local .
docker run --rm -p 3000:3000 node-ai-research-reproducibility:local
```

## License

[MIT](LICENSE)
