import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createDatasetStore, createRoutes } from '../src/routes.ts';

test('counts duplicate rows and schema violations', async (t) => {
  const server = await start(createRoutes(createDatasetStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/datasets', {
    method: 'POST',
    body: {
      name: 'people',
      schema: { id: 'number', name: 'string' },
      rows: [
        { id: 1, name: 'Ada' },
        { id: 1, name: 'Ada' },
        { id: 'x', name: '' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['duplicateRows'], 1);
  const violations = report['schemaViolations'] as unknown[];
  assert.ok(violations.length >= 1);
  assert.ok(numberOf(report['score']) < 100);
  const fetched = await requestJson(server.url, `/v1/datasets/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

function numberOf(value: unknown): number {
  assert.equal(typeof value, 'number');
  return value as number;
}

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-dataset-quality',
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
