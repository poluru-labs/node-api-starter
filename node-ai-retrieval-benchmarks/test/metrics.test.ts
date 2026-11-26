import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRetrievalStore, createRoutes } from '../src/routes.ts';

test('averages precision, recall, MRR, nDCG, and hit rate', async (t) => {
  const server = await start(createRoutes(createRetrievalStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/benchmarks', {
    method: 'POST',
    body: {
      name: 'bm25',
      k: 2,
      queries: [
        { id: 'q1', relevant: ['d1', 'd3'], ranked: ['d1', 'd3'] },
        { id: 'q2', relevant: ['d9'], ranked: ['d1', 'd2'] },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['precisionAtK'], 0.5);
  assert.equal(report['recallAtK'], 0.5);
  assert.equal(report['mrr'], 0.5);
  assert.equal(report['ndcgAtK'], 0.5);
  assert.equal(report['hitRate'], 0.5);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-retrieval-benchmarks',
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
