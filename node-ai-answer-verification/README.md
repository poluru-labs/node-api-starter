# Answer Verification

Answer verification. Split an answer into sentences and score each one against the supplied sources with token overlap. This is a lexical check, not a neural entailment model. Cite a source as `[sourceId]` in the sentence.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/verifications`

```json
{
  "question": "What does photosynthesis do?",
  "answer": "Photosynthesis converts light into chemical energy in plants [s1].",
  "sources": [
    { "id": "s1", "text": "Photosynthesis converts light into chemical energy in plants." }
  ]
}
```

`verdict` is `supported`, `partial`, or `unsupported`. Each claim has `status`, `sourceId`, and `score`. `method` is `lexical-overlap`.

`GET /v1/verifications/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-answer-verification.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                         | Result                      |
| -------- | ---------------------------- | --------------------------- |
| `GET`    | `/v1/mock/verifications`     | List the fixture records    |
| `POST`   | `/v1/mock/verifications`     | Add a JSON record           |
| `GET`    | `/v1/mock/verifications/:id` | Read one record             |
| `PUT`    | `/v1/mock/verifications/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/verifications/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/verifications/:id` | Remove one record           |

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
docker build --tag node-ai-answer-verification:local .
docker run --rm -p 3000:3000 node-ai-answer-verification:local
```

## License

[MIT](LICENSE)
