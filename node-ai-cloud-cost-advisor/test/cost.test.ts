import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createCostStore, createRoutes } from '../src/routes.ts';

test('prices usage and flags a later spend spike', async (t) => {
  const server = await start(createRoutes(createCostStore()));
  t.after(() => server.close());
  const account = await requestJson(server.url, '/v1/accounts', {
    method: 'POST',
    body: { name: 'prod', rates: { 'cpu.small': 1 } },
  });
  assert.equal(account.status, 201);
  const id = String(record(account.body)['id']);
  const first = await requestJson(server.url, `/v1/accounts/${id}/usage`, {
    method: 'POST',
    body: { items: [{ sku: 'cpu.small', hours: 20 }] },
  });
  assert.equal(record(first.body)['totalUsd'], 20);
  const second = await requestJson(server.url, `/v1/accounts/${id}/usage`, {
    method: 'POST',
    body: {
      items: [
        { sku: 'cpu.small', hours: 40 },
        { sku: 'gpu.unknown', hours: 1 },
      ],
    },
  });
  const advice = record(second.body)['advice'] as unknown[];
  const codes = advice.map((item) => record(item)['code']);
  assert.ok(codes.includes('spend_spike'));
  assert.ok(codes.includes('unknown_sku'));
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-cloud-cost-advisor',
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
