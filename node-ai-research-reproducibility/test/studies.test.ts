import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRoutes, createStudyStore } from '../src/routes.ts';

test('awards a reusable badge only when the checklist is complete', async (t) => {
  const server = await start(createRoutes(createStudyStore()));
  t.after(() => server.close());
  const full = await requestJson(server.url, '/v1/studies', {
    method: 'POST',
    body: {
      title: 'Pinned climate rerun',
      data: true,
      code: true,
      environment: 'lockfile',
      seed: true,
      command: true,
      hardware: true,
      license: true,
    },
  });
  assert.equal(record(full.body)['score'], 100);
  assert.equal(record(full.body)['badge'], 'reusable');
  const thin = await requestJson(server.url, '/v1/studies', {
    method: 'POST',
    body: {
      title: 'Script only',
      data: false,
      code: true,
      environment: 'none',
      seed: false,
      command: true,
      hardware: false,
      license: false,
    },
  });
  assert.equal(record(thin.body)['score'], 35);
  assert.equal(record(thin.body)['badge'], 'incomplete');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-research-reproducibility',
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
