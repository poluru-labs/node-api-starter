import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createContractStore, createRoutes } from '../src/routes.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('passes a matching observation and reports a contract violation', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const created = await requestJson(server.url, '/v1/contracts', {
    method: 'POST',
    body: {
      name: 'list-items',
      method: 'get',
      path: '/v1/items',
      expect: {
        status: 200,
        required: ['id'],
        types: { id: 'string', count: 'number' },
        maxLatencyMs: 300,
      },
    },
  });
  assert.equal(created.status, 201);
  const id = String(record(created.body)['id']);

  const passed = await requestJson(server.url, `/v1/contracts/${id}/observations`, {
    method: 'POST',
    body: { status: 200, latencyMs: 20, body: { id: 'item-1', count: 2 } },
  });
  assert.equal(passed.status, 201);
  assert.equal(record(record(passed.body)['observation'])['passed'], true);

  const failed = await requestJson(server.url, `/v1/contracts/${id}/observations`, {
    method: 'POST',
    body: { status: 500, latencyMs: 900, body: { count: '2' } },
  });
  const observation = record(record(failed.body)['observation']);
  assert.equal(observation['passed'], false);
  const codes = (observation['violations'] as unknown[]).map((item) => record(item)['code']);
  for (const code of ['status_mismatch', 'latency_budget', 'missing_field', 'type_mismatch']) {
    assert.ok(codes.includes(code), code);
  }

  const report = await requestJson(server.url, `/v1/contracts/${id}`);
  assert.equal(record(report.body)['passRate'], 0.5);
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-api-contract-monitor',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createContractStore()) });
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
