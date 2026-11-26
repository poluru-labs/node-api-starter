import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { App, Route } from '../src/app.ts';
import type { AppConfig, NodeEnvironment } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import type { RunningServer } from '../src/server.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

interface Fixture {
  readonly app: App;
  readonly server: RunningServer;
}

test('serves health, the sample root, and echoes a request id', async (t) => {
  const { server } = await start();
  t.after(() => server.close());

  const health = await requestJson(server.url, '/health');
  assert.equal(health.status, 200);
  assert.equal(health.contentType, 'application/json; charset=utf-8');
  assert.deepEqual(health.body, { status: 'ok', service: 'node-boilerplate-test' });
  assert.equal(typeof health.requestId, 'string');

  const traced = await requestJson(server.url, '/health?live=1', { requestId: 'req-7' });
  assert.equal(traced.requestId, 'req-7');

  const root = await requestJson(server.url, '/');
  assert.equal(root.status, 200);
  assert.deepEqual(root.body, {
    service: 'node-boilerplate-test',
    message: 'Service is running.',
  });
});

test('readiness follows setReady', async (t) => {
  const { app, server } = await start({ ready: false });
  t.after(() => server.close());

  const waiting = await requestJson(server.url, '/ready');
  assert.equal(waiting.status, 503);
  assert.deepEqual(waiting.body, { status: 'not_ready' });

  app.setReady(true);
  const ready = await requestJson(server.url, '/ready');
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: 'ready' });
});

test('unknown paths and methods return JSON errors', async (t) => {
  const { server } = await start();
  t.after(() => server.close());

  const missing = await requestJson(server.url, '/missing');
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'not_found' });

  const denied = await requestJson(server.url, '/', { method: 'POST' });
  assert.equal(denied.status, 405);
  assert.equal(denied.allow, 'GET');
  assert.deepEqual(denied.body, { error: 'method_not_allowed' });
});

test('handler failures stay JSON and hide messages in production', async (t) => {
  const routes: readonly Route[] = [
    {
      method: 'GET',
      path: '/boom',
      handler() {
        throw new Error('database password');
      },
    },
    {
      method: 'GET',
      path: '/empty',
      handler() {
        return undefined;
      },
    },
  ];

  const development = await start({ routes, nodeEnv: 'development' });
  t.after(() => development.server.close());
  const shown = await requestJson(development.server.url, '/boom');
  assert.equal(shown.status, 500);
  assert.deepEqual(shown.body, {
    error: 'internal_error',
    requestId: shown.requestId,
    message: 'database password',
  });

  const empty = await requestJson(development.server.url, '/empty');
  assert.equal(empty.status, 500);
  assert.deepEqual(empty.body, { error: 'empty_response' });

  const production = await start({ routes, nodeEnv: 'production' });
  t.after(() => production.server.close());
  const hidden = await requestJson(production.server.url, '/boom');
  assert.equal(hidden.status, 500);
  assert.deepEqual(hidden.body, { error: 'internal_error' });
});

test('built-in health route wins over a custom route on the same path', async (t) => {
  const { server } = await start({
    routes: [
      {
        method: 'GET',
        path: '/health',
        handler(ctx) {
          ctx.sendJson(200, { status: 'replaced' });
        },
      },
    ],
  });
  t.after(() => server.close());

  const health = await requestJson(server.url, '/health');
  assert.deepEqual(health.body, { status: 'ok', service: 'node-boilerplate-test' });
});

test('library entry does not bind a port', async () => {
  const api = await import('../src/index.ts');
  assert.equal(typeof api.createApp, 'function');
  assert.equal(typeof api.listen, 'function');
  assert.equal(typeof api.loadConfig, 'function');
});

async function start(
  options: {
    readonly routes?: readonly Route[];
    readonly ready?: boolean;
    readonly nodeEnv?: NodeEnvironment;
  } = {},
): Promise<Fixture> {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: options.nodeEnv ?? 'test',
    logLevel: 'error',
    serviceName: 'node-boilerplate-test',
  };
  const logger = createLogger({
    level: 'error',
    service: config.serviceName,
    stream: mute(),
  });
  const app = createApp({
    config,
    logger,
    ...(options.routes === undefined ? {} : { routes: options.routes }),
  });
  const server = await listen(app, config);
  app.setReady(options.ready ?? true);
  return { app, server };
}

function mute(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}
