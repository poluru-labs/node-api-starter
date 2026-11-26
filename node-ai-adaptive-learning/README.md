# Adaptive Learning

Adaptive learning. Learners submit attempts against a fixed skill catalog. The next recommendation is the lowest-mastery skill, with difficulty in the range 1–5.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/learners` with `{ "name": "Amina" }`.

`POST /v1/learners/:id/attempts`

```json
{ "skillId": "foundations", "correct": true, "difficulty": 3 }
```

`skillId` is `foundations`, `practice`, or `transfer`. `difficulty` is an integer from 1 to 5. A correct answer raises mastery; an incorrect answer lowers it. The response includes the updated learner and the next recommendation.

`GET /v1/learners/:id/next` returns the next skill without recording an attempt.

Learner state lives in memory.

## Mock API

Fixture file: `mocks/node-ai-adaptive-learning.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/learners`     | List the fixture records    |
| `POST`   | `/v1/mock/learners`     | Add a JSON record           |
| `GET`    | `/v1/mock/learners/:id` | Read one record             |
| `PUT`    | `/v1/mock/learners/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/learners/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/learners/:id` | Remove one record           |

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
docker build --tag node-ai-adaptive-learning:local .
docker run --rm -p 3000:3000 node-ai-adaptive-learning:local
```

## License

[MIT](LICENSE)
