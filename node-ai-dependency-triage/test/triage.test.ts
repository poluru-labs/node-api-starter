import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createRoutes, createTriageStore } from '../src/routes.ts';

test('flags advisories, deprecations, licenses, outdated packages, and duplicates', async (t) => {
  const server = await start(createRoutes(createTriageStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/reports', {
    method: 'POST',
    body: {
      ecosystem: 'npm',
      failOn: 'high',
      allowedLicenses: ['MIT'],
      dependencies: [
        {
          name: 'left-pad',
          version: '1.0.0',
          direct: true,
          license: 'MIT',
          deprecated: true,
          latest: '2.0.0',
        },
        { name: 'lodash', version: '1.0.0', direct: true, license: 'MIT' },
        { name: 'lodash', version: '4.17.21', direct: false, license: 'MIT', latest: '4.17.21' },
        {
          name: 'badlib',
          version: '1.0.0',
          direct: true,
          license: 'GPL-3.0',
          advisories: [{ id: 'GHSA-1111', severity: 'critical' }],
        },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const found = codes(report['findings'], 'code');
  for (const code of ['advisory', 'deprecated', 'license', 'outdated', 'duplicate']) {
    assert.ok(found.includes(code), code);
  }
  const fetched = await requestJson(server.url, `/v1/reports/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-dependency-triage',
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
