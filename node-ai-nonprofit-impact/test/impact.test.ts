import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createProgramStore, createRoutes } from '../src/routes.ts';

test('sums beneficiaries and flags an activity without an outcome', async (t) => {
  const server = await start(createRoutes(createProgramStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/programs', {
    method: 'POST',
    body: { name: 'Literacy', mission: 'Help people read.' },
  });
  const id = String(record(created.body)['id']);
  await requestJson(server.url, `/v1/programs/${id}/activities`, {
    method: 'POST',
    body: {
      name: 'Classes',
      output: '20 sessions',
      outcome: 'Reading gains',
      beneficiaries: 100,
      costUsd: 500,
      period: '2026-Q1',
    },
  });
  await requestJson(server.url, `/v1/programs/${id}/activities`, {
    method: 'POST',
    body: {
      name: 'Books',
      output: '50 books',
      beneficiaries: 40,
      costUsd: 100,
      period: '2026-Q1',
    },
  });
  const fetched = await requestJson(server.url, `/v1/programs/${id}`);
  const impact = record(record(fetched.body)['impact']);
  assert.equal(impact['totalBeneficiaries'], 140);
  assert.equal(impact['totalCostUsd'], 600);
  assert.equal(impact['costPerBeneficiary'], 4.29);
  assert.equal(impact['missingOutcomes'], 1);
  assert.equal(impact['beneficiaryMethod'], 'sum-of-activities');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-nonprofit-impact',
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
