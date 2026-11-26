import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createRoutes, createSyntheticStore } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('flags duplicates, range misses, unknown categories, and identifier-like values', async (t) => {
  const server = await start(createRoutes(createSyntheticStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/checks', {
    method: 'POST',
    body: {
      fields: [
        { name: 'age', type: 'number', minimum: 0, maximum: 120 },
        { name: 'city', type: 'string', categories: ['north', 'south'] },
      ],
      rows: [
        { age: 30, city: 'north' },
        { age: 30, city: 'north' },
        { age: 200, city: 'mars' },
        { age: 10, city: 'ada@example.com' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  assert.equal(report['duplicateRows'], 1);
  const codes = (report['findings'] as unknown[]).map((item) => record(item)['code']);
  for (const code of ['duplicate_row', 'out_of_range', 'unknown_category', 'sensitive_value']) {
    assert.ok(codes.includes(code), code);
  }
  assert.equal(JSON.stringify(created.body).includes('ada@example.com'), false);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-synthetic-data-validator',
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
