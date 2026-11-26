import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createReviewStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('computes majority, conflicts, and Fleiss kappa', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const created = await requestJson(server.url, '/v1/tasks', {
    method: 'POST',
    body: { itemId: 'item-1', allowedLabels: ['yes', 'no'] },
  });
  assert.equal(created.status, 201);
  const taskId = String(record(created.body)['id']);

  await requestJson(server.url, `/v1/tasks/${taskId}/judgments`, {
    method: 'POST',
    body: { annotatorId: 'ada', label: 'yes' },
  });
  const second = await requestJson(server.url, `/v1/tasks/${taskId}/judgments`, {
    method: 'POST',
    body: { annotatorId: 'grace', label: 'no' },
  });
  assert.equal(second.status, 201);
  const agreement = record(record(second.body)['agreement']);
  assert.equal(agreement['unanimous'], false);
  assert.equal(agreement['majorityLabel'], null);
  assert.equal(agreement['pairwiseAgreement'], 0);

  await requestJson(server.url, `/v1/tasks/${taskId}/judgments`, {
    method: 'POST',
    body: { annotatorId: 'linus', label: 'yes' },
  });
  const fetched = await requestJson(server.url, `/v1/tasks/${taskId}`);
  const latest = record(record(fetched.body)['agreement']);
  assert.equal(latest['majorityLabel'], 'yes');

  const corpus = await requestJson(server.url, '/v1/agreement');
  assert.equal(corpus.status, 200);
  assert.equal(typeof record(corpus.body)['fleissKappa'], 'number');

  const rejected = await requestJson(server.url, `/v1/tasks/${taskId}/judgments`, {
    method: 'POST',
    body: { annotatorId: 'ada', label: 'maybe' },
  });
  assert.equal(rejected.status, 400);
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-annotation-review',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createReviewStore()) });
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
