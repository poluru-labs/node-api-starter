import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRoutes, createSuiteStore } from '../src/routes.ts';

test('marks an unchanged case and a changed case', async (t) => {
  const server = await start(createRoutes(createSuiteStore()));
  t.after(() => server.close());
  const suite = await requestJson(server.url, '/v1/suites', {
    method: 'POST',
    body: {
      name: 'greetings',
      cases: [
        { id: 'hi', prompt: 'Say hi', baseline: 'hello' },
        { id: 'ready', prompt: 'Say ready', baseline: 'ready' },
      ],
    },
  });
  const id = String(record(suite.body)['id']);
  const run = await requestJson(server.url, `/v1/suites/${id}/runs`, {
    method: 'POST',
    body: {
      cases: [
        { id: 'hi', output: 'hello' },
        { id: 'ready', output: 'not ready' },
      ],
    },
  });
  const report = record(run.body);
  assert.equal(report['passRate'], 0.5);
  assert.equal(report['ok'], false);
  const statuses = (report['results'] as unknown[]).map((item) => record(item)['status']);
  assert.deepEqual(statuses, ['match', 'changed']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-prompt-regression',
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
