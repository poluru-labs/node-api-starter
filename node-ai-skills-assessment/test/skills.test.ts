import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createRoutes, createSkillStore } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

test('reports the skill that is below the target level', async (t) => {
  const server = await start(createRoutes(createSkillStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/assessments', {
    method: 'POST',
    body: {
      learner: 'Amina',
      targetLevel: 3,
      scores: [
        { skillId: 'communication', level: 4, evidence: 'Explained the result to the group.' },
        { skillId: 'problem-solving', level: 2, evidence: 'Needed a hint on the second task.' },
        { skillId: 'collaboration', level: 3, evidence: 'Shared the work evenly.' },
        { skillId: 'digital-literacy', level: 3, evidence: 'Used the spreadsheet correctly.' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['average'], 3);
  assert.equal(report['met'], false);
  assert.deepEqual(report['gaps'], ['problem-solving']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-skills-assessment',
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
