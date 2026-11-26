import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createReadingStore, createRoutes } from '../src/routes.ts';

test('simplifies a hard passage and stores the report', async (t) => {
  const server = await start(createRoutes(createReadingStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/readings', {
    method: 'POST',
    body: {
      text: 'The individuals utilize additional assistance in order to obtain sufficient information.',
      targetGrade: 6,
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(typeof report['gradeLevel'], 'number');
  assert.ok(String(report['simplified']).includes('people'));
  assert.ok(String(report['simplified']).includes('help'));
  const flags = report['flags'];
  assert.equal(Array.isArray(flags), true);
  const fetched = await requestJson(server.url, `/v1/readings/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-assistive-reading',
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
