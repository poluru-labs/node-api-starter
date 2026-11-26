import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createQualityStore, createRoutes } from '../src/routes.ts';

test('flags an untranslated segment and a missing placeholder', async (t) => {
  const server = await start(createRoutes(createQualityStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/reviews', {
    method: 'POST',
    body: {
      sourceLocale: 'en',
      targetLocale: 'fr',
      segments: [
        {
          id: 's1',
          source: 'Hello {name}, you have 2 messages.',
          target: 'Hello {name}, you have 2 messages.',
        },
        { id: 's2', source: 'Save {name}', target: 'Enregistrer' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const codes = (report['findings'] as unknown[]).map((item) => record(item)['code']);
  assert.ok(codes.includes('untranslated'));
  assert.ok(codes.includes('placeholder_mismatch'));
  const fetched = await requestJson(server.url, `/v1/reviews/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-multilingual-quality',
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
