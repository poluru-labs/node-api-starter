import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createPaperStore, createRoutes } from '../src/routes.ts';

test('ranks a paper by overlapping title terms', async (t) => {
  const server = await start(createRoutes(createPaperStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/papers', {
    method: 'POST',
    body: {
      title: 'Transformers for clinical notes',
      authors: ['Ada Lovelace'],
      year: 2024,
      abstract: 'Attention models read clinical notes with transformers.',
      keywords: ['transformers', 'nlp'],
      doi: '10.1000/clinical',
    },
  });
  assert.equal(created.status, 201);
  await requestJson(server.url, '/v1/papers', {
    method: 'POST',
    body: {
      title: 'Glacier mass balance methods',
      authors: ['Grace Hopper'],
      year: 2024,
      abstract: 'This study measures ice loss across high mountain seasons.',
      keywords: ['ice'],
    },
  });
  const found = await requestJson(server.url, '/v1/discover', {
    method: 'POST',
    body: { query: 'clinical transformers', yearFrom: 2020, limit: 5 },
  });
  const matches = record(found.body)['matches'] as unknown[];
  assert.equal(matches.length, 1);
  assert.equal(record(matches[0])['score'], 6);
  assert.deepEqual(record(matches[0])['matchedTerms'], ['clinical', 'transformers']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-literature-discovery',
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
