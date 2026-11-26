# Code Review

Code review. Scan submitted files for secrets, dynamic code execution, debugger statements, empty catches, loose equality, console.log, long lines, and long files. Finding messages do not repeat secret values.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/reviews`

```json
{ "files": [{ "path": "src/app.ts", "content": "console.log('x');\n" }] }
```

Paths must be relative and must not contain `..`. JavaScript and TypeScript files also get `loose-equality` and `console` checks.

`GET /v1/reviews/:id` returns the score and findings. File contents are not stored.

## Mock API

Fixture file: `mocks/node-ai-code-review.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                   | Result                      |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/v1/mock/reviews`     | List the fixture records    |
| `POST`   | `/v1/mock/reviews`     | Add a JSON record           |
| `GET`    | `/v1/mock/reviews/:id` | Read one record             |
| `PUT`    | `/v1/mock/reviews/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/reviews/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/reviews/:id` | Remove one record           |

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
docker build --tag node-ai-code-review:local .
docker run --rm -p 3000:3000 node-ai-code-review:local
```

## License

[MIT](LICENSE)
