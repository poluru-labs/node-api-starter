# Assistive Reading

Assistive reading. Grade a passage with Flesch-Kincaid, flag long sentences and hard words, and replace a fixed set of difficult phrases when the grade is above the requested target.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/readings`

```json
{ "text": "The individuals utilize additional assistance.", "targetGrade": 6 }
```

`targetGrade` is an integer from 1 to 16. The response includes `gradeLevel`, `readingEase`, counts, `flags`, and `simplified`.

`GET /v1/readings/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-assistive-reading.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/readings`     | List the fixture records    |
| `POST`   | `/v1/mock/readings`     | Add a JSON record           |
| `GET`    | `/v1/mock/readings/:id` | Read one record             |
| `PUT`    | `/v1/mock/readings/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/readings/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/readings/:id` | Remove one record           |

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
docker build --tag node-ai-assistive-reading:local .
docker run --rm -p 3000:3000 node-ai-assistive-reading:local
```

## License

[MIT](LICENSE)
