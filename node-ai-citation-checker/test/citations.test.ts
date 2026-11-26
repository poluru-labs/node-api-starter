import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createCitationStore, createRoutes } from '../src/routes.ts';

test('flags an uncited reference, an unmatched citation, and a bad doi', async (t) => {
  const server = await start(createRoutes(createCitationStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/checks', {
    method: 'POST',
    body: {
      text: 'Smith (2020) agrees. (Ng, 2021) does not.',
      references: [
        { authors: 'Smith, J.', year: 2020, title: 'Study', doi: '10.1000/xyz' },
        { authors: 'Lee', year: 2019, title: 'Other', doi: 'not-a-doi' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const unmatched = report['unmatched'] as unknown[];
  assert.equal(record(unmatched[0])['author'], 'Ng');
  const uncited = report['uncited'] as unknown[];
  assert.equal(record(uncited[0])['year'], 2019);
  const invalid = report['invalid'] as unknown[];
  assert.equal(record(invalid[0])['code'], 'invalid_doi');
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-citation-checker',
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
