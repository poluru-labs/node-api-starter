import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createReplayStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

const baseline = [
  { name: 'search', input: { q: 'wcag' }, output: { hits: 2 } },
  { name: 'answer', input: { hits: 2 }, output: { text: 'ok' } },
];

test('a matching replay has no diffs and a changed output is reported', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const created = await requestJson(server.url, '/v1/replays', {
    method: 'POST',
    body: { name: 'research', steps: baseline },
  });
  assert.equal(created.status, 201);
  const id = String(record(created.body)['id']);

  const same = await requestJson(server.url, `/v1/replays/${id}/comparisons`, {
    method: 'POST',
    body: { steps: [{ name: 'search', input: { q: 'wcag' }, output: { hits: 2 } }, baseline[1]] },
  });
  assert.equal(same.status, 200);
  assert.equal(record(record(same.body)['comparison'])['matched'], true);

  const changed = await requestJson(server.url, `/v1/replays/${id}/comparisons`, {
    method: 'POST',
    body: {
      steps: [baseline[0], { name: 'answer', input: { hits: 2 }, output: { text: 'different' } }],
    },
  });
  const comparison = record(record(changed.body)['comparison']);
  assert.equal(comparison['matched'], false);
  const diffs = comparison['diffs'];
  assert.equal(Array.isArray(diffs), true);
  assert.equal(record((diffs as unknown[])[0])['field'], 'output');
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-agent-replay',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createReplayStore()) });
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
