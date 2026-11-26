import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createMonitorStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('flags a flat stretch, a spike, and turbidity above the threshold', async (t) => {
  const server = await start(createRoutes(createMonitorStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/monitors', {
    method: 'POST',
    body: { name: 'Intake', metric: 'turbidity', unit: 'NTU' },
  });
  assert.equal(created.status, 201);
  const readings = await requestJson(
    server.url,
    `/v1/monitors/${String(record(created.body)['id'])}/readings`,
    {
      method: 'POST',
      body: {
        points: [
          { at: '2026-06-01T00:00:00Z', value: 1 },
          { at: '2026-06-01T01:00:00Z', value: 1 },
          { at: '2026-06-01T02:00:00Z', value: 1 },
          { at: '2026-06-01T03:00:00Z', value: 1 },
          { at: '2026-06-01T04:00:00Z', value: 20 },
        ],
      },
    },
  );
  assert.equal(readings.status, 200);
  const report = record(readings.body);
  const codes = (report['anomalies'] as unknown[]).map((item) => record(item)['code']);
  for (const code of ['flatline', 'spike', 'threshold']) {
    assert.ok(codes.includes(code), code);
  }
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-water-anomaly-monitor',
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
