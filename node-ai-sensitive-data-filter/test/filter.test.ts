import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createFilterStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

const secret = 'AKIAIOSFODNN7EXAMPLE';
const email = 'ada@example.com';
const card = '4111111111111111';

test('redacts an email, a card, and a secret without echoing them', async (t) => {
  const server = await start(createRoutes(createFilterStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/filters', {
    method: 'POST',
    body: { text: `Contact ${email} about card ${card} key ${secret}.` },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const redacted = String(report['redacted']);
  assert.match(redacted, /\[redacted:email\]/);
  assert.match(redacted, /\[redacted:card\]/);
  assert.match(redacted, /\[redacted:secret\]/);
  const encoded = JSON.stringify(created.body);
  assert.equal(encoded.includes(email), false);
  assert.equal(encoded.includes(card), false);
  assert.equal(encoded.includes(secret), false);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-sensitive-data-filter',
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
