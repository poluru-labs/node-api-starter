import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { Route } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';
import { createExplorerStore, createRoutes } from '../src/routes.ts';

test('finds deep nesting, a TODO, a long file, and imports', async (t) => {
  const server = await start(createRoutes(createExplorerStore()));
  t.after(() => server.close());
  const nested = [
    "import { read } from './io.js';",
    "const fs = require('fs');",
    'function run() {',
    '  if (a) {',
    '    if (b) {',
    '      if (c) {',
    '        if (d) {',
    '          if (e) {',
    '            if (f) {',
    '              return 1; // TODO: replace',
    '            }',
    '          }',
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
  ].join('\n');
  const created = await requestJson(server.url, '/v1/explorations', {
    method: 'POST',
    body: {
      files: [
        { path: 'src/app.js', content: nested },
        {
          path: 'src/data.js',
          content: Array.from({ length: 401 }, () => 'const n = 1;').join('\n'),
        },
      ],
    },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  const rules = (report['findings'] as unknown[]).map((item) => record(item)['rule']);
  for (const rule of ['deep-nesting', 'todo', 'long-file']) {
    assert.ok(rules.includes(rule), rule);
  }
  assert.deepEqual(report['dependencies'], ['./io.js', 'fs']);
});

async function start(routes: readonly Route[]) {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-legacy-code-explorer',
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
