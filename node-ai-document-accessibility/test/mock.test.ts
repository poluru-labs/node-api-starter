import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

const endpoint = '/v1/mock/documents';

test('serves the mock fixture for list, create, update, and delete', async (t) => {
  const server = await start(createRoutes());
  t.after(() => server.close());

  const listed = await requestJson(server.url, endpoint);
  assert.equal(listed.status, 200);
  const catalog = record(listed.body);
  assert.equal(catalog['endpoint'], endpoint);
  const items = catalog['items'];
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 3);
  const firstId = String(record(items[0])['id']);

  const fetched = await requestJson(server.url, `${endpoint}/${firstId}`);
  assert.equal(fetched.status, 200);
  assert.equal(record(fetched.body)['id'], firstId);

  const created = await requestJson(server.url, endpoint, {
    method: 'POST',
    body: { note: 'follow-up logged at the 2026-11-12 desk review' },
  });
  assert.equal(created.status, 201);
  const createdId = String(record(created.body)['id']);

  const patched = await requestJson(server.url, `${endpoint}/${createdId}`, {
    method: 'PATCH',
    body: { status: 'closed' },
  });
  assert.equal(patched.status, 200);
  assert.equal(record(patched.body)['status'], 'closed');

  const removed = await requestJson(server.url, `${endpoint}/${createdId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(record(removed.body)['deleted'], true);

  const missing = await requestJson(server.url, `${endpoint}/${createdId}`);
  assert.equal(missing.status, 404);

  const duplicate = await requestJson(server.url, endpoint, {
    method: 'POST',
    body: { id: firstId, note: 'second copy' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(record(duplicate.body)['error'], 'duplicate');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-document-accessibility',
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
