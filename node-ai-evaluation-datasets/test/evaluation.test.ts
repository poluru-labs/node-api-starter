import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createEvaluationStore, createRoutes } from '../src/routes.ts';

test('reports duplicate ids and split leakage', async (t) => {
  const server = await start(createRoutes(createEvaluationStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/evaluations', {
    method: 'POST',
    body: {
      name: 'qa',
      task: 'question-answering',
      items: [
        { id: 'q1', input: 'What is 2+2?', expected: '4', split: 'train' },
        { id: 'q1', input: 'Other', expected: 'x', split: 'test' },
        { id: 'q2', input: 'What is 2+2?', expected: '4', split: 'test' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const found = codes(report['findings'], 'code');
  assert.ok(found.includes('duplicate_id'));
  assert.ok(found.includes('leakage'));
  const fetched = await requestJson(server.url, `/v1/evaluations/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-evaluation-datasets',
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

function codes(value: unknown, key: string): string[] {
  assert.equal(Array.isArray(value), true);
  return (value as unknown[]).map((item) => String(record(item)[key]));
}
