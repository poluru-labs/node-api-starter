import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createApprovalStore, createRoutes } from '../src/routes.ts';

test('auto-approves low risk, redacts secrets, and records one human decision', async (t) => {
  const server = await start(createRoutes(createApprovalStore()));
  t.after(() => server.close());
  const low = await requestJson(server.url, '/v1/requests', {
    method: 'POST',
    body: { actor: 'planner', action: 'draft-note', summary: 'Save a draft', risk: 'low' },
  });
  assert.equal(record(low.body)['status'], 'approved');
  assert.equal(record((record(low.body)['decisions'] as unknown[])[0])['reviewer'], 'policy');

  const high = await requestJson(server.url, '/v1/requests', {
    method: 'POST',
    body: {
      actor: 'mailer',
      action: 'send-email',
      summary: 'Send the invoice',
      risk: 'high',
      payload: { apiKey: 'supersecret', note: 'invoice 18' },
    },
  });
  assert.equal(high.status, 201);
  const pending = record(high.body);
  assert.equal(pending['status'], 'pending');
  assert.equal(record(pending['payload'])['apiKey'], '[redacted]');
  assert.equal(record(pending['payload'])['note'], 'invoice 18');
  const id = String(pending['id']);

  const decision = await requestJson(server.url, `/v1/requests/${id}/decisions`, {
    method: 'POST',
    body: { reviewer: 'sam', decision: 'approve', reason: 'Customer requested the invoice.' },
  });
  assert.equal(record(decision.body)['status'], 'approved');
  const again = await requestJson(server.url, `/v1/requests/${id}/decisions`, {
    method: 'POST',
    body: { reviewer: 'sam', decision: 'reject', reason: 'Too late' },
  });
  assert.equal(again.status, 409);
  assert.deepEqual(again.body, { error: 'already_decided' });

  const critical = await requestJson(server.url, '/v1/requests', {
    method: 'POST',
    body: {
      actor: 'mailer',
      action: 'delete-account',
      summary: 'Delete the account',
      risk: 'critical',
    },
  });
  const criticalId = String(record(critical.body)['id']);
  const shortReason = await requestJson(server.url, `/v1/requests/${criticalId}/decisions`, {
    method: 'POST',
    body: { reviewer: 'sam', decision: 'approve', reason: 'no' },
  });
  assert.equal(shortReason.status, 400);
  assert.deepEqual(shortReason.body, { error: 'reason_required' });
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-human-approval',
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
