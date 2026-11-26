import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRoutes, createWasteStore } from '../src/routes.ts';

test('recommends less bread and more soup', async (t) => {
  const server = await start(createRoutes(createWasteStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/kitchens', {
    method: 'POST',
    body: {
      name: 'cafe',
      records: [
        { day: '2026-11-01', item: 'bread', prepared: 10, sold: 5, wasted: 5 },
        { day: '2026-11-02', item: 'bread', prepared: 10, sold: 5, wasted: 5 },
        { day: '2026-11-01', item: 'soup', prepared: 4, sold: 4, wasted: 0 },
        { day: '2026-11-02', item: 'soup', prepared: 4, sold: 4, wasted: 0 },
      ],
    },
  });
  assert.equal(created.status, 201);
  const items = (record(created.body)['items'] as unknown[]).map((item) => record(item));
  const bread = items.find((item) => item['item'] === 'bread');
  const soup = items.find((item) => item['item'] === 'soup');
  assert.equal(bread?.['advice'], 'reduce');
  assert.equal(bread?.['recommend'], 6);
  assert.equal(soup?.['advice'], 'increase');
  assert.equal(soup?.['recommend'], 5);
  const fetched = await requestJson(
    server.url,
    `/v1/kitchens/${String(record(created.body)['id'])}`,
  );
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-food-waste-forecasting',
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
