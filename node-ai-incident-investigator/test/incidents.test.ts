import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createIncidentStore, createRoutes } from '../src/routes.ts';

test('correlates a deploy, an error burst, and a second service', async (t) => {
  const server = await start(createRoutes(createIncidentStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/incidents', {
    method: 'POST',
    body: { title: 'Checkout errors', severity: 'sev1', service: 'checkout' },
  });
  assert.equal(created.status, 201);
  const id = String(record(created.body)['id']);
  await requestJson(server.url, `/v1/incidents/${id}/events`, {
    method: 'POST',
    body: { at: '2026-11-26T12:00:00Z', kind: 'deploy', message: 'Shipped checkout 1.8.0' },
  });
  await requestJson(server.url, `/v1/incidents/${id}/events`, {
    method: 'POST',
    body: { at: '2026-11-26T12:10:00Z', kind: 'alert', message: 'Error rate above threshold' },
  });
  await requestJson(server.url, `/v1/incidents/${id}/events`, {
    method: 'POST',
    body: { at: '2026-11-26T12:11:00Z', kind: 'alert', message: 'Error rate still high' },
  });
  const burst = await requestJson(server.url, `/v1/incidents/${id}/events`, {
    method: 'POST',
    body: {
      at: '2026-11-26T12:12:00Z',
      kind: 'alert',
      message: 'Billing timed out',
      service: 'billing',
    },
  });
  const codes = (record(burst.body)['hypotheses'] as unknown[]).map((item) => record(item)['code']);
  for (const code of ['recent_deploy', 'error_burst', 'cross_service']) {
    assert.ok(codes.includes(code), String(code));
  }
  const resolved = await requestJson(server.url, `/v1/incidents/${id}/status`, {
    method: 'POST',
    body: { status: 'resolved' },
  });
  assert.equal(record(resolved.body)['status'], 'resolved');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-incident-investigator',
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
