import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createPermissionStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('allows a scoped call, denies a missing scope, and holds a high-risk tool', async (t) => {
  const server = await start(createRoutes(createPermissionStore()));
  t.after(() => server.close());
  const mail = await requestJson(server.url, '/v1/tools', {
    method: 'POST',
    body: { name: 'send-email', risk: 'medium', scopes: ['mail.send'] },
  });
  const removal = await requestJson(server.url, '/v1/tools', {
    method: 'POST',
    body: { name: 'delete-account', risk: 'high', scopes: ['account.delete'] },
  });
  assert.equal(mail.status, 201);
  assert.equal(removal.status, 201);
  const allowed = await requestJson(server.url, '/v1/checks', {
    method: 'POST',
    body: { tool: 'send-email', scopes: ['mail.send'], maxRisk: 'high' },
  });
  const denied = await requestJson(server.url, '/v1/checks', {
    method: 'POST',
    body: { tool: 'send-email', scopes: ['mail.delete'], maxRisk: 'high' },
  });
  const held = await requestJson(server.url, '/v1/checks', {
    method: 'POST',
    body: { tool: 'delete-account', scopes: ['account.delete'], maxRisk: 'high' },
  });
  assert.equal(record(allowed.body)['decision'], 'allow');
  assert.equal(record(denied.body)['reason'], 'missing_scope');
  assert.equal(record(held.body)['decision'], 'require_approval');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-tool-permissions',
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
