import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRoutes, createTriageStore } from '../src/routes.ts';

test('sorts a crash, a docs typo, a duplicate title, and a security report', async (t) => {
  const server = await start(createRoutes(createTriageStore()));
  t.after(() => server.close());
  const crash = await requestJson(server.url, '/v1/items', {
    method: 'POST',
    body: { kind: 'issue', title: 'App crash on save', body: 'it breaks', hasReproduction: false },
  });
  assert.equal(record(crash.body)['queue'], 'needs-info');
  assert.equal(
    record((record(crash.body)['reasons'] as unknown[])[0])['code'],
    'needs_reproduction',
  );

  await requestJson(server.url, '/v1/items', {
    method: 'POST',
    body: { kind: 'issue', title: 'Typo in README', body: 'Fix teh typo' },
  });
  const similar = await requestJson(server.url, '/v1/items', {
    method: 'POST',
    body: { kind: 'issue', title: 'Typo in the README', body: 'Another typo' },
  });
  const similarBody = record(similar.body);
  assert.equal(similarBody['queue'], 'good-first-issue');
  assert.equal(record((similarBody['similar'] as unknown[])[0])['title'], 'Typo in README');
  assert.equal(record((similarBody['similar'] as unknown[])[0])['score'], 1);

  const security = await requestJson(server.url, '/v1/items', {
    method: 'POST',
    body: {
      kind: 'issue',
      title: 'Possible CVE in login',
      body: 'A vulnerability was reported.',
    },
  });
  const securityBody = record(security.body);
  assert.equal(securityBody['queue'], 'security');
  assert.equal(securityBody['priority'], 'urgent');
  assert.equal(record((securityBody['reasons'] as unknown[])[0])['code'], 'private_disclosure');
  assert.equal(JSON.stringify(security.body).includes('A vulnerability was reported'), false);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-open-source-triage',
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
