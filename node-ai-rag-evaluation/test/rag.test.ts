import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRagStore, createRoutes } from '../src/routes.ts';

test('accepts a grounded citation and rejects an unknown one', async (t) => {
  const server = await start(createRoutes(createRagStore()));
  t.after(() => server.close());
  const grounded = await requestJson(server.url, '/v1/evaluations', {
    method: 'POST',
    body: {
      question: 'Where does photosynthesis happen?',
      answer: 'Photosynthesis happens in leaves [c1].',
      contexts: [{ id: 'c1', text: 'Photosynthesis happens in leaves of green plants.' }],
    },
  });
  const good = record(grounded.body);
  assert.equal(good['faithfulness'], 1);
  assert.equal(good['ok'], true);
  assert.deepEqual(good['unknownCitations'], []);
  const missed = await requestJson(server.url, '/v1/evaluations', {
    method: 'POST',
    body: {
      question: 'Where does photosynthesis happen?',
      answer: 'Mars is red [c9].',
      contexts: [{ id: 'c1', text: 'Photosynthesis happens in leaves of green plants.' }],
    },
  });
  const bad = record(missed.body);
  assert.equal(bad['ok'], false);
  assert.deepEqual(bad['unknownCitations'], ['c9']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-rag-evaluation',
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
