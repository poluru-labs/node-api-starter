import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createCatalogStore, createRoutes } from '../src/routes.ts';

test('ranks a housing service in the requested area', async (t) => {
  const server = await start(createRoutes(createCatalogStore()));
  t.after(() => server.close());
  await requestJson(server.url, '/v1/services', {
    method: 'POST',
    body: {
      name: 'Housing help',
      agency: 'City Housing',
      category: 'housing',
      area: 'North',
      eligibility: ['rent', 'low income'],
      channel: 'online',
    },
  });
  await requestJson(server.url, '/v1/services', {
    method: 'POST',
    body: {
      name: 'South tax desk',
      agency: 'City Finance',
      category: 'tax',
      area: 'South',
      eligibility: ['rent'],
      channel: 'office',
    },
  });
  const found = await requestJson(server.url, '/v1/search', {
    method: 'POST',
    body: { query: 'rent housing', area: 'north', limit: 5 },
  });
  const matches = record(found.body)['matches'] as unknown[];
  assert.equal(matches.length, 1);
  assert.equal(record(matches[0])['name'], 'Housing help');
  assert.equal(record(matches[0])['score'], 4);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-public-service-search',
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
