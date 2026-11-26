# Rag Evaluation

RAG evaluation. Score an answer against retrieved contexts with lexical faithfulness, answer relevance, and context relevance. Citations use bracket ids such as [c1]. ok is true when faithfulness is at least 0.5 and every citation names a supplied context. This is not a model judge.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/evaluations`

```json
{
  "question": "Where does photosynthesis happen?",
  "answer": "Photosynthesis happens in leaves [c1].",
  "contexts": [{ "id": "c1", "text": "Photosynthesis happens in leaves of green plants." }]
}
```

The question, answer, and context text are not stored.

`GET /v1/evaluations/:id` returns the scores and citation check.

## Mock API

Fixture file: `mocks/node-ai-rag-evaluation.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path               | Result                      |
| -------- | ------------------ | --------------------------- |
| `GET`    | `/v1/mock/rag`     | List the fixture records    |
| `POST`   | `/v1/mock/rag`     | Add a JSON record           |
| `GET`    | `/v1/mock/rag/:id` | Read one record             |
| `PUT`    | `/v1/mock/rag/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/rag/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/rag/:id` | Remove one record           |

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
docker build --tag node-ai-rag-evaluation:local .
docker run --rm -p 3000:3000 node-ai-rag-evaluation:local
```

## License

[MIT](LICENSE)
