import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createGapStore, createRoutes } from '../src/routes.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('reports a function that no test file names', async (t) => {
  const server = await start(createRoutes(createGapStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/analyses', {
    method: 'POST',
    body: {
      files: [
        {
          path: 'src/app.ts',
          content: 'export function greet() { return 1; }\nfunction unused() { return 2; }\n',
        },
        { path: 'test/app.test.ts', content: 'greet();\n' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['coverage'], 0.5);
  assert.equal(report['functionCount'], 2);
  const gaps = report['gaps'] as unknown[];
  assert.equal(gaps.length, 1);
  assert.equal(record(gaps[0])['name'], 'unused');
  assert.equal(JSON.stringify(created.body).includes('return 2'), false);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-test-gap-analyzer',
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
