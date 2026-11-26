# Citation Checker

Citation checker. Find Author (Year) and (Author, Year) citations, then report references that are never cited, citations with no reference, and DOIs that are not `10.xxxx/suffix`.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/checks`

```json
{
  "text": "Smith (2020) agrees.",
  "references": [{ "authors": "Smith, J.", "year": 2020, "title": "Study", "doi": "10.1000/xyz" }]
}
```

`ok` is true only when every citation has a reference, every reference is cited, and every DOI is valid.

`GET /v1/checks/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-citation-checker.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                           | Result                      |
| -------- | ------------------------------ | --------------------------- |
| `GET`    | `/v1/mock/citation-checks`     | List the fixture records    |
| `POST`   | `/v1/mock/citation-checks`     | Add a JSON record           |
| `GET`    | `/v1/mock/citation-checks/:id` | Read one record             |
| `PUT`    | `/v1/mock/citation-checks/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/citation-checks/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/citation-checks/:id` | Remove one record           |

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
docker build --tag node-ai-citation-checker:local .
docker run --rm -p 3000:3000 node-ai-citation-checker:local
```

## License

[MIT](LICENSE)
