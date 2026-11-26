import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createBenchmarkStore, createRoutes } from '../src/routes.ts';

test('summarizes latency percentiles and flags a missed objective', async (t) => {
  const server = await start(createRoutes(createBenchmarkStore()));
  t.after(() => server.close());
  const steady = await requestJson(server.url, '/v1/benchmarks', {
    method: 'POST',
    body: {
      model: 'small-v1',
      samples: Array.from({ length: 20 }, () => ({
        latencyMs: 80,
        tokensIn: 20,
        tokensOut: 40,
        success: true,
      })),
    },
  });
  assert.equal(steady.status, 201);
  const report = record(steady.body);
  assert.equal(report['p95Ms'], 80);
  assert.equal(report['tokensPerSecond'], 500);
  assert.equal(report['successRate'], 1);
  assert.equal(report['ok'], true);

  const slow = await requestJson(server.url, '/v1/benchmarks', {
    method: 'POST',
    body: {
      model: 'large-v1',
      slo: { maxP95Ms: 500, minSuccessRate: 0.99 },
      samples: Array.from({ length: 5 }, () => ({
        latencyMs: 1000,
        tokensIn: 10,
        tokensOut: 10,
        success: true,
      })),
    },
  });
  const slowBody = record(slow.body);
  assert.equal(slowBody['ok'], false);
  assert.equal(record((slowBody['flags'] as unknown[])[0])['code'], 'latency_slo');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-inference-benchmarks',
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
