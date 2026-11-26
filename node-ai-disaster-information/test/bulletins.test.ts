import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createBulletinStore, createRoutes } from '../src/routes.ts';

test('returns an active bulletin and standard protective actions', async (t) => {
  const server = await start(createRoutes(createBulletinStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/bulletins', {
    method: 'POST',
    body: {
      event: 'flood',
      severity: 'severe',
      area: 'North',
      headline: 'River flood warning',
      instruction: 'Move to higher ground.',
      issuedAt: '2026-11-26T12:00:00Z',
      expiresAt: '2026-12-01T00:00:00Z',
    },
  });
  assert.equal(created.status, 201);
  await requestJson(server.url, '/v1/bulletins', {
    method: 'POST',
    body: {
      event: 'flood',
      severity: 'minor',
      area: 'north',
      headline: 'Old flood note',
      instruction: 'This warning has ended.',
      issuedAt: '2020-01-01T00:00:00Z',
      expiresAt: '2020-01-02T00:00:00Z',
    },
  });
  const guidance = await requestJson(server.url, '/v1/guidance', {
    method: 'POST',
    body: { area: 'north', event: 'flood', at: '2026-11-26T18:00:00Z' },
  });
  const body = record(guidance.body);
  assert.equal(body['source'], 'bulletin');
  const bulletins = body['bulletins'] as unknown[];
  assert.equal(bulletins.length, 1);
  assert.equal(record(bulletins[0])['headline'], 'River flood warning');
  assert.ok((body['actions'] as unknown[]).includes('Move to higher ground.'));
  assert.ok((body['actions'] as unknown[]).includes('Do not walk or drive through flood water.'));
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-disaster-information',
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
