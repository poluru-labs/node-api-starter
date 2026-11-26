import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createArtifactStore, createRoutes } from '../src/routes.ts';

test('links a paper to a dataset and finds the paper by title', async (t) => {
  const server = await start(createRoutes(createArtifactStore()));
  t.after(() => server.close());
  const paper = await requestJson(server.url, '/v1/artifacts', {
    method: 'POST',
    body: {
      kind: 'paper',
      title: 'Climate dataset notes',
      version: '1.0.0',
      license: 'CC-BY-4.0',
      identifier: '10.1000/climate',
      summary: 'Notes that describe the climate measurements.',
    },
  });
  const dataset = await requestJson(server.url, '/v1/artifacts', {
    method: 'POST',
    body: {
      kind: 'dataset',
      title: 'City temperatures',
      version: '2',
      license: 'CC0-1.0',
      identifier: 'city-temps',
      summary: 'Daily temperature readings.',
    },
  });
  const paperId = String(record(paper.body)['id']);
  const datasetId = String(record(dataset.body)['id']);
  const linked = await requestJson(server.url, `/v1/artifacts/${paperId}/relations`, {
    method: 'POST',
    body: { type: 'uses', targetId: datasetId },
  });
  assert.equal(record((record(linked.body)['relations'] as unknown[])[0])['targetId'], datasetId);
  const found = await requestJson(server.url, '/v1/search', {
    method: 'POST',
    body: { query: 'climate', kind: 'paper', limit: 5 },
  });
  const matches = record(found.body)['matches'] as unknown[];
  assert.equal(matches.length, 1);
  assert.equal(record(matches[0])['title'], 'Climate dataset notes');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-research-artifact-index',
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
