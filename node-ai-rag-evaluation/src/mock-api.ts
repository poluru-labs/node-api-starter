import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';

const mockMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type MockMethod = (typeof mockMethods)[number];

export interface MockRecord {
  id: string;
  [key: string]: unknown;
}

export interface MockSpec {
  readonly endpoint: string;
  readonly methods: readonly MockMethod[];
  readonly records: readonly MockRecord[];
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;

export function loadMockSpec(fileName: string): MockSpec {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(resolve(here, '../mocks', fileName), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    typeof parsed['endpoint'] !== 'string' ||
    !Array.isArray(parsed['records'])
  ) {
    throw new Error(`Invalid mock spec in ${fileName}`);
  }
  if (!/^\/v1\/mock\/[a-z0-9-]+$/.test(parsed['endpoint'])) {
    throw new Error(`Invalid mock endpoint in ${fileName}`);
  }
  if (!Array.isArray(parsed['methods']) || parsed['methods'].length === 0) {
    throw new Error(`Invalid mock methods in ${fileName}`);
  }
  const selected: MockMethod[] = [];
  for (const method of parsed['methods']) {
    if (!isMockMethod(method) || selected.includes(method)) {
      throw new Error(`Invalid mock methods in ${fileName}`);
    }
    selected.push(method);
  }
  const records: MockRecord[] = [];
  for (const entry of parsed['records']) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || !idPattern.test(entry['id'])) {
      throw new Error(`Invalid mock record in ${fileName}`);
    }
    records.push({ ...entry, id: entry['id'] });
  }
  return { endpoint: parsed['endpoint'], methods: selected, records };
}

export function createMockRoutes(spec: MockSpec): readonly Route[] {
  const items: MockRecord[] = spec.records.map((record) => ({ ...record }));
  const routes: Route[] = [];
  if (spec.methods.includes('GET')) {
    routes.push({
      method: 'GET',
      path: spec.endpoint,
      handler(ctx) {
        ctx.sendJson(200, { endpoint: spec.endpoint, items });
      },
    });
    routes.push({
      method: 'GET',
      path: `${spec.endpoint}/:id`,
      handler(ctx) {
        const item = items.find((entry) => entry.id === (ctx.params['id'] ?? ''));
        if (item === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, item);
      },
    });
  }
  if (spec.methods.includes('POST')) {
    routes.push({
      method: 'POST',
      path: spec.endpoint,
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const id = readId(body['id']);
        if (id === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (items.some((entry) => entry.id === id)) {
          ctx.sendJson(409, { error: 'duplicate' });
          return;
        }
        const created = assignFields({ id }, body);
        items.push(created);
        ctx.sendJson(201, created);
      },
    });
  }
  if (spec.methods.includes('PUT')) {
    routes.push({
      method: 'PUT',
      path: `${spec.endpoint}/:id`,
      async handler(ctx) {
        const index = items.findIndex((entry) => entry.id === (ctx.params['id'] ?? ''));
        const current = items[index];
        if (current === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const replaced = assignFields({ id: current.id }, body);
        items[index] = replaced;
        ctx.sendJson(200, replaced);
      },
    });
  }
  if (spec.methods.includes('PATCH')) {
    routes.push({
      method: 'PATCH',
      path: `${spec.endpoint}/:id`,
      async handler(ctx) {
        const index = items.findIndex((entry) => entry.id === (ctx.params['id'] ?? ''));
        const current = items[index];
        if (current === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const updated = assignFields({ ...current }, body);
        items[index] = updated;
        ctx.sendJson(200, updated);
      },
    });
  }
  if (spec.methods.includes('DELETE')) {
    routes.push({
      method: 'DELETE',
      path: `${spec.endpoint}/:id`,
      handler(ctx) {
        const index = items.findIndex((entry) => entry.id === (ctx.params['id'] ?? ''));
        const current = items[index];
        if (current === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        items.splice(index, 1);
        ctx.sendJson(200, { id: current.id, deleted: true });
      },
    });
  }
  return routes;
}

function readId(value: unknown): string | undefined {
  if (value === undefined) {
    return randomUUID();
  }
  if (typeof value === 'string' && idPattern.test(value)) {
    return value;
  }
  return undefined;
}

function assignFields(target: MockRecord, body: Record<string, unknown>): MockRecord {
  for (const [key, value] of Object.entries(body)) {
    if (key === 'id' || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    target[key] = value;
  }
  return target;
}

function isMockMethod(value: unknown): value is MockMethod {
  return typeof value === 'string' && mockMethods.some((method) => method === value);
}
