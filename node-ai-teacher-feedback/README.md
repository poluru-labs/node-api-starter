# Teacher Feedback

Teacher feedback. Turn rubric scores into strength, developing, and practice comments. The essay itself is not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/assignments`

```json
{
  "title": "Lab report",
  "criteria": [{ "id": "accuracy", "name": "Accuracy", "maxPoints": 4 }]
}
```

`POST /v1/assignments/:id/feedback` accepts a student name and one integer score plus a short note for every criterion. A score of at least 80 percent of the maximum is `strength`, at least 50 percent is `developing`, and the rest is `practice`.

`GET /v1/feedback/:id` returns the comments and the total.

## Mock API

Fixture file: `mocks/node-ai-teacher-feedback.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                       | Result                      |
| -------- | -------------------------- | --------------------------- |
| `GET`    | `/v1/mock/assignments`     | List the fixture records    |
| `POST`   | `/v1/mock/assignments`     | Add a JSON record           |
| `GET`    | `/v1/mock/assignments/:id` | Read one record             |
| `PUT`    | `/v1/mock/assignments/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/assignments/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/assignments/:id` | Remove one record           |

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
docker build --tag node-ai-teacher-feedback:local .
docker run --rm -p 3000:3000 node-ai-teacher-feedback:local
```

## License

[MIT](LICENSE)
