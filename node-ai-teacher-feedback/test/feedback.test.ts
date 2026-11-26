import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createFeedbackStore, createRoutes } from '../src/routes.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('labels a high score as a strength and a low score as practice', async (t) => {
  const server = await start(createRoutes(createFeedbackStore()));
  t.after(() => server.close());
  const assignment = await requestJson(server.url, '/v1/assignments', {
    method: 'POST',
    body: {
      title: 'Lab report',
      criteria: [
        { id: 'accuracy', name: 'Accuracy', maxPoints: 4 },
        { id: 'clarity', name: 'Clarity', maxPoints: 4 },
      ],
    },
  });
  assert.equal(assignment.status, 201);
  const created = await requestJson(
    server.url,
    `/v1/assignments/${String(record(assignment.body)['id'])}/feedback`,
    {
      method: 'POST',
      body: {
        student: 'Noah',
        scores: [
          { criterionId: 'accuracy', points: 4, note: 'The measurements match the data.' },
          { criterionId: 'clarity', points: 1, note: 'The conclusion needs a clearer sentence.' },
        ],
      },
    },
  );
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['total'], 5);
  assert.equal(report['maxPoints'], 8);
  const bands = (report['comments'] as unknown[]).map((item) => record(item)['band']);
  assert.deepEqual(bands, ['strength', 'practice']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-teacher-feedback',
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
