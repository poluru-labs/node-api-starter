import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createBffStore, createRoutes } from '../src/routes.ts';

test('composes a view and marks a missing optional part as partial', async (t) => {
  const server = await start(createRoutes(createBffStore()));
  t.after(() => server.close());
  const resource = await requestJson(server.url, '/v1/resources/profile', {
    method: 'PUT',
    body: { data: { name: 'Ada' } },
  });
  assert.equal(resource.status, 200);
  const view = await requestJson(server.url, '/v1/views/home', {
    method: 'PUT',
    body: {
      parts: [
        { key: 'profile', required: true },
        { key: 'alerts', required: false },
      ],
    },
  });
  assert.equal(view.status, 200);
  const composed = await requestJson(server.url, '/v1/views/home');
  const body = record(composed.body);
  assert.equal(body['ok'], true);
  assert.equal(body['partial'], true);
  assert.deepEqual(record(body['data'])['profile'], { name: 'Ada' });
  assert.equal(record(body['data'])['alerts'], null);

  await requestJson(server.url, '/v1/resources/alerts', {
    method: 'PUT',
    body: { data: [{ id: 'n1' }] },
  });
  const full = record((await requestJson(server.url, '/v1/views/home')).body);
  assert.equal(full['partial'], false);
  assert.equal(full['ok'], true);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-bff-starter',
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
