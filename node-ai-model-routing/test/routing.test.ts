import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createModelStore, createRoutes } from '../src/routes.ts';

test('picks the cheapest model that meets capability, privacy, and latency', async (t) => {
  const server = await start(createRoutes(createModelStore()));
  t.after(() => server.close());
  const small = await requestJson(server.url, '/v1/models', {
    method: 'POST',
    body: {
      name: 'small-summarizer',
      tier: 'small',
      costPer1kTokens: 0.1,
      maxLatencyMs: 200,
      capabilities: ['summarize'],
      allowsSensitive: false,
    },
  });
  assert.equal(small.status, 201);
  await requestJson(server.url, '/v1/models', {
    method: 'POST',
    body: {
      name: 'large-coder',
      tier: 'large',
      costPer1kTokens: 2,
      maxLatencyMs: 800,
      capabilities: ['summarize', 'code'],
      allowsSensitive: true,
    },
  });
  const summary = await requestJson(server.url, '/v1/routes', {
    method: 'POST',
    body: { task: 'summarize', needs: ['summarize'], sensitive: false },
  });
  assert.equal(record(record(summary.body)['matched'])['name'], 'small-summarizer');
  const code = await requestJson(server.url, '/v1/routes', {
    method: 'POST',
    body: { task: 'code', needs: ['code'], sensitive: true },
  });
  assert.equal(record(record(code.body)['matched'])['name'], 'large-coder');
  const blocked = await requestJson(server.url, '/v1/routes', {
    method: 'POST',
    body: { task: 'code', needs: ['code'], sensitive: false, maxLatencyMs: 100 },
  });
  assert.equal(record(blocked.body)['matched'], null);
  assert.equal(record(blocked.body)['reason'], 'no_match');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-model-routing',
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
