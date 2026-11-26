# Multilingual Quality

Multilingual quality. Compare source and target segments for an empty target, an unchanged translation, placeholder drift, missing numbers, a large length change, and whitespace differences. Segment text is not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/reviews`

```json
{
  "sourceLocale": "en",
  "targetLocale": "fr",
  "segments": [{ "id": "s1", "source": "Save {name}", "target": "Enregistrer {name}" }]
}
```

Placeholders are `{name}`, `{{name}}`, and printf tokens such as `%s`. A length warning applies when the source has at least 20 characters and the target is under 0.4 times or over 2.5 times that length. `ok` is true when every finding is minor.

`GET /v1/reviews/:id` returns the score and findings.

## Mock API

Fixture file: `mocks/node-ai-multilingual-quality.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/segments`     | List the fixture records    |
| `POST`   | `/v1/mock/segments`     | Add a JSON record           |
| `GET`    | `/v1/mock/segments/:id` | Read one record             |
| `PUT`    | `/v1/mock/segments/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/segments/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/segments/:id` | Remove one record           |

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
docker build --tag node-ai-multilingual-quality:local .
docker run --rm -p 3000:3000 node-ai-multilingual-quality:local
```

## License

[MIT](LICENSE)
