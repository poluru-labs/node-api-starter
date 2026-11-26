# Accessibility Auditor

Accessibility auditor. `POST /v1/audits` checks HTML against a documented WCAG subset and stores a score plus findings. `GET /v1/audits/:id` returns that report. Checks are deterministic and do not call a model.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/audits`

```json
{
  "html": "<html lang=\"en\"><head><title>Report</title></head><body><main><h1>Report</h1></main></body></html>",
  "level": "AA"
}
```

`level` is `A`, `AA`, or `AAA`. The default is `AA`.

The response includes `score`, `summary`, and `findings`. Each finding has `rule`, `impact`, `wcag`, and `message`.

Rules:

| Rule             | WCAG  | Levels  |
| ---------------- | ----- | ------- |
| `html-lang`      | 3.1.1 | A       |
| `document-title` | 2.4.2 | A       |
| `image-alt`      | 1.1.1 | A       |
| `button-name`    | 4.1.2 | A       |
| `link-name`      | 2.4.4 | A       |
| `label`          | 1.3.1 | A       |
| `duplicate-id`   | 4.1.1 | A       |
| `landmark-main`  | 2.4.1 | A       |
| `heading-order`  | 1.3.1 | AA, AAA |
| `meta-viewport`  | 1.4.4 | AA, AAA |
| `tabindex`       | 2.4.3 | AAA     |

`GET /v1/audits/:id` returns the stored report. Reports live in memory, up to 1,000, and are dropped oldest first.

## Mock API

Fixture file: `mocks/node-ai-accessibility-auditor.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                  | Result                      |
| -------- | --------------------- | --------------------------- |
| `GET`    | `/v1/mock/audits`     | List the fixture records    |
| `POST`   | `/v1/mock/audits`     | Add a JSON record           |
| `GET`    | `/v1/mock/audits/:id` | Read one record             |
| `PUT`    | `/v1/mock/audits/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/audits/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/audits/:id` | Remove one record           |

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
docker build --tag node-ai-accessibility-auditor:local .
docker run --rm -p 3000:3000 node-ai-accessibility-auditor:local
```

## License

[MIT](LICENSE)
