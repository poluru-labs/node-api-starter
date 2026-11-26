import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createRoutes, createTraceStore } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('records a run, redacts secrets, and summarizes events', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const created = await requestJson(server.url, '/v1/runs', {
    method: 'POST',
    body: { agent: 'research-agent' },
  });
  assert.equal(created.status, 201);
  const runId = String(record(created.body)['id']);

  const event = await requestJson(server.url, `/v1/runs/${runId}/events`, {
    method: 'POST',
    body: {
      kind: 'tool',
      name: 'search',
      status: 'error',
      durationMs: 40,
      tokens: 12,
      complete: true,
      attributes: { apiKey: 'sk-secret', query: 'wcag' },
    },
  });
  assert.equal(event.status, 201);
  const body = record(event.body);
  assert.equal(body['status'], 'error');
  assert.equal(body['errorCount'], 1);
  assert.equal(body['totalTokens'], 12);
  const events = body['events'];
  assert.equal(Array.isArray(events), true);
  const attributes = record(record((events as unknown[])[0])['attributes']);
  assert.equal(attributes['apiKey'], '[redacted]');
  assert.equal(attributes['query'], 'wcag');

  const list = await requestJson(server.url, '/v1/runs');
  assert.equal(list.status, 200);
  const runs = record(list.body)['runs'];
  assert.equal(Array.isArray(runs), true);
  assert.equal((runs as unknown[]).length, 1);
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-agent-observability',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createTraceStore()) });
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
