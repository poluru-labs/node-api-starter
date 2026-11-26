import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRoutes, createValidationStore } from '../src/routes.ts';

test('rejects an enum miss, a wrong type, and an extra property', async (t) => {
  const server = await start(createRoutes(createValidationStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/validations', {
    method: 'POST',
    body: {
      output: { answer: 'maybe', confidence: 'high', extra: true },
      contract: {
        type: 'object',
        additionalProperties: false,
        required: ['answer', 'confidence'],
        properties: {
          answer: { type: 'string', enum: ['yes', 'no'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const codes = (report['violations'] as unknown[]).map((item) => record(item)['code']);
  for (const code of ['enum_mismatch', 'type_mismatch', 'additional_property']) {
    assert.ok(codes.includes(code), code);
  }
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-output-validation',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes });
  const server = await listen(app, config);
  app.setReady(true);
  return server;
}

function mute(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}
