import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createEnergyStore, createRoutes } from '../src/routes.ts';

test('forecasts a flat week with seasonal naive and a short series with a line', async (t) => {
  const server = await start(createRoutes(createEnergyStore()));
  t.after(() => server.close());
  const flat = await requestJson(server.url, '/v1/series', {
    method: 'POST',
    body: {
      name: 'flat',
      unit: 'kWh',
      points: Array.from({ length: 14 }, (_, index) => ({
        at: `2026-01-${String(index + 1).padStart(2, '0')}`,
        value: 10,
      })),
    },
  });
  const flatId = String(record(flat.body)['id']);
  const seasonal = await requestJson(server.url, `/v1/series/${flatId}/forecast`, {
    method: 'POST',
    body: { horizon: 2 },
  });
  const seasonalBody = record(seasonal.body);
  assert.equal(seasonalBody['method'], 'seasonal-naive');
  assert.equal(seasonalBody['mae'], 0);
  const seasonalPoints = seasonalBody['points'] as unknown[];
  assert.equal(record(seasonalPoints[0])['value'], 10);
  assert.equal(record(seasonalPoints[0])['at'], '2026-01-15');

  const line = await requestJson(server.url, '/v1/series', {
    method: 'POST',
    body: {
      name: 'line',
      unit: 'kWh',
      points: [
        { at: '2026-02-01', value: 2 },
        { at: '2026-02-02', value: 4 },
        { at: '2026-02-03', value: 6 },
      ],
    },
  });
  const linear = await requestJson(
    server.url,
    `/v1/series/${String(record(line.body)['id'])}/forecast`,
    {
      method: 'POST',
      body: { horizon: 1 },
    },
  );
  const linearBody = record(linear.body);
  assert.equal(linearBody['method'], 'linear');
  assert.equal(record((linearBody['points'] as unknown[])[0])['value'], 8);
  assert.equal(record((linearBody['points'] as unknown[])[0])['at'], '2026-02-04');

  const spike = await requestJson(server.url, '/v1/series', {
    method: 'POST',
    body: {
      name: 'spike',
      unit: 'kWh',
      points: Array.from({ length: 11 }, (_, index) => ({
        at: `2026-03-${String(index + 1).padStart(2, '0')}`,
        value: index === 10 ? 100 : 5,
      })),
    },
  });
  assert.deepEqual(record(spike.body)['anomalies'], ['2026-03-11']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-energy-forecasting',
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
