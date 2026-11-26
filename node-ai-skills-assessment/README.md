# Skills Assessment

Skills assessment. Score a learner on a fixed competency rubric and report the average, whether the target level was met, and the skills that are still below it.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/assessments`

```json
{
  "learner": "Amina",
  "targetLevel": 3,
  "scores": [
    { "skillId": "communication", "level": 4, "evidence": "Explained the result to the group." }
  ]
}
```

Every request scores all four skills: `communication`, `problem-solving`, `collaboration`, and `digital-literacy`. Levels are integers from 1 to 4. A skill below `targetLevel` is a gap. `met` is true only when every skill meets the target.

`GET /v1/assessments/:id` returns the same report.

## Mock API

Fixture file: `mocks/node-ai-skills-assessment.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                         | Result                      |
| -------- | ---------------------------- | --------------------------- |
| `GET`    | `/v1/mock/skill-reports`     | List the fixture records    |
| `POST`   | `/v1/mock/skill-reports`     | Add a JSON record           |
| `GET`    | `/v1/mock/skill-reports/:id` | Read one record             |
| `PUT`    | `/v1/mock/skill-reports/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/skill-reports/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/skill-reports/:id` | Remove one record           |

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
docker build --tag node-ai-skills-assessment:local .
docker run --rm -p 3000:3000 node-ai-skills-assessment:local
```

## License

[MIT](LICENSE)
