import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createResourceStore, createRoutes } from '../src/routes.ts';

test('ranks a resource in the requested region and skips another region', async (t) => {
  const server = await start(createRoutes(createResourceStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/resources', {
    method: 'POST',
    body: { name: 'North Food Bank', needs: ['food', 'housing'], region: 'North' },
  });
  assert.equal(created.status, 201);
  await requestJson(server.url, '/v1/resources', {
    method: 'POST',
    body: { name: 'South Clinic', needs: ['food'], region: 'South' },
  });
  const matched = await requestJson(server.url, '/v1/matches', {
    method: 'POST',
    body: { needs: ['food'], region: 'north', limit: 5 },
  });
  const matches = record(matched.body)['matches'] as unknown[];
  assert.equal(matches.length, 1);
  assert.equal(record(matches[0])['name'], 'North Food Bank');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-community-resource-matcher',
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
