# Output Validation

Output validation. Check a JSON value against a contract for type, enum, range, length, required properties, and extra properties. The raw output is not stored.

Created by [Subrahmanyam Poluru](https://polurus.com).

## API

`POST /v1/validations`

```json
{
  "output": { "answer": "yes", "confidence": 0.8 },
  "contract": {
    "type": "object",
    "additionalProperties": false,
    "required": ["answer"],
    "properties": {
      "answer": { "type": "string", "enum": ["yes", "no"] },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  }
}
```

Types are `string`, `number`, `boolean`, `object`, `array`, and `null`. `additionalProperties` defaults to true.

`GET /v1/validations/:id` returns the violations.

## Mock API

Fixture file: `mocks/node-ai-output-validation.json`. The process loads that file into memory. Writes change the in-memory copy. Restarting the process reads the file again.

| Method   | Path                       | Result                      |
| -------- | -------------------------- | --------------------------- |
| `GET`    | `/v1/mock/validations`     | List the fixture records    |
| `POST`   | `/v1/mock/validations`     | Add a JSON record           |
| `GET`    | `/v1/mock/validations/:id` | Read one record             |
| `PUT`    | `/v1/mock/validations/:id` | Replace one record          |
| `PATCH`  | `/v1/mock/validations/:id` | Update fields on one record |
| `DELETE` | `/v1/mock/validations/:id` | Remove one record           |

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
docker build --tag node-ai-output-validation:local .
docker run --rm -p 3000:3000 node-ai-output-validation:local
```

## License

[MIT](LICENSE)
