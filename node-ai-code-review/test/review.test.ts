import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createReviewStore, createRoutes } from '../src/routes.ts';

test('reports secrets, eval, and console.log without echoing the secret', async (t) => {
  const server = await start(createRoutes(createReviewStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/reviews', {
    method: 'POST',
    body: {
      files: [
        {
          path: 'src/app.ts',
          content: "const key = 'AKIAIOSFODNN7EXAMPLE';\neval('1');\nconsole.log('x');\n",
        },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  const rules = (report['findings'] as unknown[]).map((item) => record(item)['rule']);
  for (const rule of ['secret', 'eval', 'console']) {
    assert.ok(rules.includes(rule), rule);
  }
  assert.equal(JSON.stringify(report).includes('AKIAIOSFODNN7EXAMPLE'), false);
  assert.ok(numberOf(report['score']) < 100);
});

function numberOf(value: unknown): number {
  assert.equal(typeof value, 'number');
  return value as number;
}

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-code-review',
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
