import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createPlainStore, createRoutes } from '../src/routes.ts';

test('replaces jargon and flags a passive sentence', async (t) => {
  const server = await start(createRoutes(createPlainStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/plain-language', {
    method: 'POST',
    body: {
      audience: 'general',
      text: 'The individuals utilize assistance in order to commence the process. The form was submitted.',
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.ok(String(report['plain']).includes('people'));
  assert.ok(String(report['plain']).includes('start'));
  const codes = (report['findings'] as unknown[]).map((item) => record(item)['code']);
  assert.ok(codes.includes('jargon'));
  assert.ok(codes.includes('passive'));
  assert.equal(report['score'], 72);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-plain-language-api',
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
