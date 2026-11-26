# Dependency Triage

Dependency triage. Score a dependency list for security advisories, deprecated packages, licenses outside an allow list, outdated versions, and duplicate installs. The service does not call a package registry.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/reports`

```json
{
  "ecosystem": "npm",
  "failOn": "high",
  "allowedLicenses": ["MIT", "Apache-2.0"],
  "dependencies": [
    {
      "name": "left-pad",
      "version": "1.0.0",
      "direct": true,
      "license": "MIT",
      "deprecated": true,
      "latest": "2.0.0",
      "advisories": [{ "id": "GHSA-1111", "severity": "high" }]
    }
  ]
}
```

`failOn` defaults to `high`. `ok` is false when any finding is at least that severe. Versions are compared as `major.minor.patch`.

`GET /v1/reports/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-dependency-triage.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                   | Result                      |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/v1/mock/reports`     | List the fixture records    |
| `POST`   | `/v1/mock/reports`     | Add a JSON record           |
| `GET`    | `/v1/mock/reports/:id` | Read one record             |
| `PUT`    | `/v1/mock/reports/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/reports/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/reports/:id` | Remove one record           |

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
docker build --tag node-ai-dependency-triage:local .
docker run --rm -p 3000:3000 node-ai-dependency-triage:local
```

## License

[MIT](LICENSE)
