import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createFairnessStore, createRoutes } from '../src/routes.ts';

test('flags a selection rate that fails the four-fifths rule', async (t) => {
  const server = await start(createRoutes(createFairnessStore()));
  t.after(() => server.close());
  const rows = [
    ...Array.from({ length: 10 }, () => ({ group: 'a', label: 1, prediction: 1 })),
    ...Array.from({ length: 10 }, () => ({ group: 'b', label: 1, prediction: 0 })),
  ];
  const created = await requestJson(server.url, '/v1/assessments', {
    method: 'POST',
    body: { protectedAttribute: 'group', rows },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  assert.equal(report['disparateImpact'], 0);
  assert.equal(report['equalOpportunityGap'], 1);
  const found = codes(report['findings'], 'code');
  assert.ok(found.includes('disparate_impact'));
  assert.ok(found.includes('equal_opportunity'));
  const groups = report['groups'] as unknown[];
  const groupB = groups.map((item) => record(item)).find((item) => item['group'] === 'b');
  assert.equal(groupB?.['truePositiveRate'], 0);
  const fetched = await requestJson(server.url, `/v1/assessments/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-fairness-testing',
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
