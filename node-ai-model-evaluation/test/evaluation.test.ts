import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createModelEvalStore, createRoutes } from '../src/routes.ts';

test('reports classification F1 and regression error', async (t) => {
  const server = await start(createRoutes(createModelEvalStore()));
  t.after(() => server.close());
  const classified = await requestJson(server.url, '/v1/evaluations', {
    method: 'POST',
    body: {
      task: 'classification',
      rows: [
        { expected: 'cat', predicted: 'cat' },
        { expected: 'cat', predicted: 'cat' },
        { expected: 'cat', predicted: 'cat' },
        { expected: 'cat', predicted: 'dog' },
        { expected: 'dog', predicted: 'dog' },
        { expected: 'dog', predicted: 'dog' },
        { expected: 'dog', predicted: 'cat' },
      ],
    },
  });
  const classes = record(classified.body);
  assert.equal(classes['accuracy'], 0.7143);
  assert.equal(classes['macroF1'], 0.7083);
  const labels = classes['classes'] as unknown[];
  assert.equal(record(labels[0])['f1'], 0.75);

  const regression = await requestJson(server.url, '/v1/evaluations', {
    method: 'POST',
    body: {
      task: 'regression',
      rows: [
        { expected: 1, predicted: 1 },
        { expected: 2, predicted: 2 },
        { expected: 3, predicted: 5 },
      ],
    },
  });
  const scores = record(regression.body);
  assert.equal(scores['mae'], 0.6667);
  assert.equal(scores['rmse'], 1.1547);
  assert.equal(scores['bias'], 0.6667);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-model-evaluation',
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
