# Plain Language Api

Plain language. Flag long sentences, passive forms, and a fixed jargon list, then replace those phrases. A general audience uses a 20-word sentence limit. An expert audience uses 30.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/plain-language`

```json
{
  "audience": "general",
  "text": "The individuals utilize assistance in order to commence the process."
}
```

`audience` defaults to `general`. The response includes `averageSentenceWords`, `score`, `findings`, and `plain`.

`GET /v1/plain-language/:id` returns the stored report.

## Mock API

Fixture file: `mocks/node-ai-plain-language-api.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                    | Result                      |
| -------- | ----------------------- | --------------------------- |
| `GET`    | `/v1/mock/passages`     | List the fixture records    |
| `POST`   | `/v1/mock/passages`     | Add a JSON record           |
| `GET`    | `/v1/mock/passages/:id` | Read one record             |
| `PUT`    | `/v1/mock/passages/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/passages/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/passages/:id` | Remove one record           |

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
docker build --tag node-ai-plain-language-api:local .
docker run --rm -p 3000:3000 node-ai-plain-language-api:local
```

## License

[MIT](LICENSE)
