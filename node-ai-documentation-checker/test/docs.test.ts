import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createDocStore, createRoutes } from '../src/routes.ts';

test('flags a README that is missing a license section and has an open code fence', async (t) => {
  const server = await start(createRoutes(createDocStore()));
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/checks', {
    method: 'POST',
    body: {
      kind: 'readme',
      text: '# Tool\n\n## Install\n\nnpm install\n\n## Usage\n\n```\nnpm start\n',
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['ok'], false);
  const found = codes(report['findings'], 'code');
  assert.ok(found.includes('missing_section'));
  assert.ok(found.includes('unclosed_fence'));
  const fetched = await requestJson(server.url, `/v1/checks/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-documentation-checker',
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
