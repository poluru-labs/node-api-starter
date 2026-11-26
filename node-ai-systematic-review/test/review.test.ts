import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createReviewStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('screens studies into include, exclude, and maybe', async (t) => {
  const server = await start(createRoutes(createReviewStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/reviews', {
    method: 'POST',
    body: {
      question: 'Does the program help adults?',
      includeTerms: ['randomized', 'adults'],
      excludeTerms: ['mouse'],
    },
  });
  assert.equal(created.status, 201);
  const review = record(created.body);
  const id = String(review['id']);
  const first = await requestJson(server.url, `/v1/reviews/${id}/studies`, {
    method: 'POST',
    body: {
      title: 'A randomized trial in adults',
      abstract: 'Adults were randomized into two groups.',
      year: 2024,
    },
  });
  const second = await requestJson(server.url, `/v1/reviews/${id}/studies`, {
    method: 'POST',
    body: {
      title: 'Mouse model of the program',
      abstract: 'A randomized mouse study that mentions adults.',
      year: 2023,
    },
  });
  const third = await requestJson(server.url, `/v1/reviews/${id}/studies`, {
    method: 'POST',
    body: {
      title: 'Adult survey',
      abstract: 'Adults answered questions about the program.',
      year: 2022,
    },
  });
  assert.equal(
    record(first.body)['study'] && record(record(first.body)['study'])['decision'],
    'include',
  );
  assert.equal(record(record(second.body)['study'])['decision'], 'exclude');
  const last = record(third.body);
  assert.equal(record(last['study'])['decision'], 'maybe');
  assert.deepEqual(record(last['summary']), {
    method: 'term-screen',
    identified: 3,
    included: 1,
    excluded: 1,
    maybe: 1,
  });
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-systematic-review',
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
