import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createLearnerStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('recommends the weakest skill and raises mastery after a correct attempt', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const created = await requestJson(server.url, '/v1/learners', {
    method: 'POST',
    body: { name: 'Amina' },
  });
  assert.equal(created.status, 201);
  const learnerId = String(record(created.body)['id']);

  const first = await requestJson(server.url, `/v1/learners/${learnerId}/next`);
  assert.equal(first.status, 200);
  assert.deepEqual(pick(record(first.body), ['skillId', 'difficulty']), {
    skillId: 'foundations',
    difficulty: 1,
  });

  const attempt = await requestJson(server.url, `/v1/learners/${learnerId}/attempts`, {
    method: 'POST',
    body: { skillId: 'foundations', correct: true, difficulty: 5 },
  });
  assert.equal(attempt.status, 200);
  const recommendation = record(record(attempt.body)['recommendation']);
  assert.equal(recommendation['skillId'], 'practice');

  const missing = await requestJson(server.url, '/v1/learners/missing/next');
  assert.equal(missing.status, 404);
});

test('rejects an attempt for an unknown skill', async (t) => {
  const server = await start();
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/learners', {
    method: 'POST',
    body: { name: 'Amina' },
  });
  const learnerId = String(record(created.body)['id']);
  const attempt = await requestJson(server.url, `/v1/learners/${learnerId}/attempts`, {
    method: 'POST',
    body: { skillId: 'memorization', correct: true, difficulty: 1 },
  });
  assert.equal(attempt.status, 400);
  assert.deepEqual(attempt.body, { error: 'invalid_body' });
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-adaptive-learning',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createLearnerStore()) });
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

function pick(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const selected: Record<string, unknown> = {};
  for (const key of keys) {
    selected[key] = value[key];
  }
  return selected;
}
