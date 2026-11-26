# Document Accessibility

Document accessibility. Check a structured document for a title, language, image alternative text, heading order, table headers, and named links. The score starts at 100 and drops by impact. The document itself is not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/documents`

```json
{
  "title": "Report",
  "language": "en",
  "pages": [
    {
      "number": 1,
      "blocks": [
        { "type": "heading", "level": 1, "text": "Overview" },
        { "type": "image", "alt": "Sales chart" },
        { "type": "table", "hasHeader": true, "text": "Quarter, revenue" }
      ]
    }
  ]
}
```

An omitted image `alt` is a failure. An empty `alt` is treated as decorative. Block types are `heading`, `paragraph`, `image`, `table`, `link`, and `list`.

`GET /v1/documents/:id` returns the score and findings.

## Mock API

Fixture file: `mocks/node-ai-document-accessibility.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                     | Result                      |
| -------- | ------------------------ | --------------------------- |
| `GET`    | `/v1/mock/documents`     | List the fixture records    |
| `POST`   | `/v1/mock/documents`     | Add a JSON record           |
| `GET`    | `/v1/mock/documents/:id` | Read one record             |
| `PUT`    | `/v1/mock/documents/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/documents/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/documents/:id` | Remove one record           |

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
docker build --tag node-ai-document-accessibility:local .
docker run --rm -p 3000:3000 node-ai-document-accessibility:local
```

## License

[MIT](LICENSE)
