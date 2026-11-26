import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createHash } from 'node:crypto';
import { createProvenanceStore, createRoutes } from '../src/routes.ts';

test('hashes content, records lineage, and rejects a cycle', async (t) => {
  const server = await start(createRoutes(createProvenanceStore()));
  t.after(() => server.close());
  const source = await requestJson(server.url, '/v1/artifacts', {
    method: 'POST',
    body: { name: 'raw', content: 'sensor-a' },
  });
  assert.equal(source.status, 201);
  const sourceBody = record(source.body);
  const expected = createHash('sha256').update('sensor-a').digest('hex');
  assert.equal(sourceBody['digest'], expected);
  const derived = await requestJson(server.url, '/v1/artifacts', {
    method: 'POST',
    body: { name: 'clean', digest: 'a'.repeat(64) },
  });
  const sourceId = String(sourceBody['id']);
  const derivedId = String(record(derived.body)['id']);
  const link = await requestJson(server.url, '/v1/derivations', {
    method: 'POST',
    body: { outputId: derivedId, inputIds: [sourceId], operation: 'clean' },
  });
  assert.equal(link.status, 201);
  const lineage = await requestJson(server.url, `/v1/artifacts/${derivedId}/lineage`);
  const entries = record(lineage.body)['lineage'] as unknown[];
  assert.equal(record(entries[1])['name'], 'raw');
  const cycle = await requestJson(server.url, '/v1/derivations', {
    method: 'POST',
    body: { outputId: sourceId, inputIds: [derivedId], operation: 'back' },
  });
  assert.equal(cycle.status, 409);
  assert.deepEqual(cycle.body, { error: 'cycle' });
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-data-provenance',
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
