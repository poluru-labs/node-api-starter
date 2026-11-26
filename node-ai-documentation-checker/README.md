# Documentation Checker

Documentation checker. Review a README, API page, changelog, or contributing guide for required sections, an unclosed code fence, empty links, images without alternative text, and leftover TODO or FIXME notes.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/checks`

```json
{ "kind": "readme", "text": "# Tool\n\n## Install\n\n## Usage\n\n## License\n" }
```

`kind` is `readme`, `api`, `changelog`, or `contributing`. A README needs a level-1 heading plus install, usage, and license sections. `ok` is true when every finding is minor.

`GET /v1/checks/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-documentation-checker.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                      | Result                      |
| -------- | ------------------------- | --------------------------- |
| `GET`    | `/v1/mock/doc-checks`     | List the fixture records    |
| `POST`   | `/v1/mock/doc-checks`     | Add a JSON record           |
| `GET`    | `/v1/mock/doc-checks/:id` | Read one record             |
| `PUT`    | `/v1/mock/doc-checks/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/doc-checks/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/doc-checks/:id` | Remove one record           |

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
docker build --tag node-ai-documentation-checker:local .
docker run --rm -p 3000:3000 node-ai-documentation-checker:local
```

## License

[MIT](LICENSE)
