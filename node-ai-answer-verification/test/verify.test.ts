import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createRoutes, createVerificationStore } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

const sources = [
  {
    id: 's1',
    text: 'Photosynthesis converts light into chemical energy in plants.',
  },
];

test('supports an answer that overlaps a cited source and rejects an unsupported one', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const supported = await requestJson(server.url, '/v1/verifications', {
    method: 'POST',
    body: {
      question: 'What does photosynthesis do?',
      answer: 'Photosynthesis converts light into chemical energy in plants [s1].',
      sources,
    },
  });
  assert.equal(supported.status, 201);
  const report = record(supported.body);
  assert.equal(report['verdict'], 'supported');
  assert.equal(report['method'], 'lexical-overlap');
  const id = String(report['id']);

  const fetched = await requestJson(server.url, `/v1/verifications/${id}`);
  assert.equal(fetched.status, 200);

  const unsupported = await requestJson(server.url, '/v1/verifications', {
    method: 'POST',
    body: {
      question: 'Where does photosynthesis happen?',
      answer: 'Photosynthesis happens primarily on Mars.',
      sources,
    },
  });
  assert.equal(record(unsupported.body)['verdict'], 'unsupported');
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-answer-verification',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createVerificationStore()) });
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
