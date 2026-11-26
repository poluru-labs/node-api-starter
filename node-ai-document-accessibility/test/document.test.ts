import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createDocumentStore, createRoutes } from '../src/routes.ts';

test('scores a document that is missing a title, image text, and table headers', async (t) => {
  const server = await start(createRoutes(createDocumentStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/documents', {
    method: 'POST',
    body: {
      title: '',
      language: 'en',
      pages: [
        {
          number: 1,
          blocks: [
            { type: 'heading', level: 1, text: 'Overview' },
            { type: 'image' },
            { type: 'table', hasHeader: false, text: 'names' },
          ],
        },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['score'], 35);
  const rules = codes(report['findings'], 'rule');
  for (const rule of ['document-title', 'image-alt', 'table-header']) {
    assert.ok(rules.includes(rule), rule);
  }
  const fetched = await requestJson(server.url, `/v1/documents/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-document-accessibility',
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
