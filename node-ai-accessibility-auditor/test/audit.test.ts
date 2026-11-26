import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { createAuditStore, createRoutes } from '../src/routes.ts';
import { listen } from '../src/server.ts';
import { requestJson } from './http.ts';

const accessible = `<!doctype html><html lang="en"><head><title>Report</title></head><body><main><h1>Report</h1><img src="chart.png" alt="Monthly trend"><a href="/home">Home</a><label for="email">Email</label><input id="email" type="email"></main></body></html>`;

const broken = `<html><body><img src="chart.png"><button></button><a href="/next"></a><input type="text"><h1>Start</h1><h3>Skip</h3><div id="a"></div><div id="a"></div></body></html>`;

test('audits HTML and returns the stored report', async (t) => {
  const server = await start();
  t.after(() => server.close());

  const created = await requestJson(server.url, '/v1/audits', {
    method: 'POST',
    body: { html: broken, level: 'AA' },
  });
  assert.equal(created.status, 201);
  const report = record(created.body);
  assert.equal(report['level'], 'AA');
  assert.equal(typeof report['id'], 'string');
  assert.ok(numberField(report['score']) < 100);
  const rules = findings(report).map((finding) => finding['rule']);
  for (const rule of [
    'html-lang',
    'document-title',
    'image-alt',
    'button-name',
    'link-name',
    'label',
    'duplicate-id',
    'landmark-main',
    'heading-order',
  ]) {
    assert.ok(rules.includes(rule), rule);
  }

  const fetched = await requestJson(server.url, `/v1/audits/${String(report['id'])}`);
  assert.equal(fetched.status, 200);
  assert.equal(record(fetched.body)['id'], report['id']);
});

test('level A does not apply AA heading and viewport rules', async (t) => {
  const server = await start();
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/audits', {
    method: 'POST',
    body: {
      html: '<html lang="en"><head><title>Report</title><meta name="viewport" content="width=device-width, maximum-scale=1"></head><body><main><h1>A</h1><h3>Skip</h3></main></body></html>',
      level: 'A',
    },
  });
  assert.equal(created.status, 201);
  const rules = findings(record(created.body)).map((finding) => finding['rule']);
  assert.equal(rules.includes('heading-order'), false);
  assert.equal(rules.includes('meta-viewport'), false);
});

test('accessible HTML at AA has no errors', async (t) => {
  const server = await start();
  t.after(() => server.close());
  const created = await requestJson(server.url, '/v1/audits', {
    method: 'POST',
    body: { html: accessible, level: 'AA' },
  });
  assert.equal(created.status, 201);
  const summary = record(record(created.body)['summary']);
  assert.equal(summary['errors'], 0);
  assert.equal(created.body && record(created.body)['score'], 100);
});

test('rejects an empty audit body', async (t) => {
  const server = await start();
  t.after(() => server.close());
  const response = await requestJson(server.url, '/v1/audits', { method: 'POST', body: {} });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'invalid_body' });
});

async function start() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    logLevel: 'error',
    serviceName: 'node-ai-accessibility-auditor',
  };
  const logger = createLogger({ level: 'error', service: config.serviceName, stream: mute() });
  const app = createApp({ config, logger, routes: createRoutes(createAuditStore()) });
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

function findings(report: Record<string, unknown>): Record<string, unknown>[] {
  const value = report['findings'];
  assert.equal(Array.isArray(value), true);
  return (value as unknown[]).map((item) => record(item));
}

function numberField(value: unknown): number {
  assert.equal(typeof value, 'number');
  return value as number;
}
