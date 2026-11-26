import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { compareRun } from './regression.ts';
import type { PromptCase, PromptSuite, RegressionRun } from './regression.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 100;

export interface SuiteStore {
  save(suite: PromptSuite): PromptSuite;
  get(id: string): PromptSuite | undefined;
  saveRun(id: string, run: RegressionRun): void;
  latest(id: string): RegressionRun | undefined;
}

export function createSuiteStore(): SuiteStore {
  const suites = new Map<string, PromptSuite>();
  const runs = new Map<string, RegressionRun>();
  return {
    save(suite) {
      remember(suites, suite.id, suite, storeLimit);
      return suite;
    },
    get(id) {
      return suites.get(id);
    },
    saveRun(id, run) {
      runs.set(id, run);
    },
    latest(id) {
      return runs.get(id);
    },
  };
}

export function createRoutes(store: SuiteStore = createSuiteStore()): readonly Route[] {
  return [
    root('Prompt regression is running.'),
    {
      method: 'POST',
      path: '/v1/suites',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseSuite(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'POST',
      path: '/v1/suites/:id/runs',
      async handler(ctx) {
        const suite = store.get(ctx.params['id'] ?? '');
        if (suite === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const outputs = parseOutputs(body);
        if (outputs === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const run = compareRun(suite, outputs, randomUUID());
        store.saveRun(suite.id, run);
        ctx.sendJson(201, run);
      },
    },
    {
      method: 'GET',
      path: '/v1/suites/:id',
      handler(ctx) {
        const suite = store.get(ctx.params['id'] ?? '');
        if (suite === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, { ...suite, latestRun: store.latest(suite.id) ?? null });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-prompt-regression.json')),
  ];
}

function parseSuite(body: unknown): { name: string; cases: PromptCase[] } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || !Array.isArray(body['cases'])) {
    return undefined;
  }
  const name = body['name'].trim();
  if (
    name.length === 0 ||
    name.length > 80 ||
    body['cases'].length === 0 ||
    body['cases'].length > 50
  ) {
    return undefined;
  }
  const cases: PromptCase[] = [];
  const seen = new Set<string>();
  for (const entry of body['cases']) {
    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      typeof entry['prompt'] !== 'string' ||
      typeof entry['baseline'] !== 'string'
    ) {
      return undefined;
    }
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(entry['id']) || seen.has(entry['id'])) {
      return undefined;
    }
    if (
      entry['prompt'].length === 0 ||
      entry['prompt'].length > 4_000 ||
      entry['baseline'].length > 4_000
    ) {
      return undefined;
    }
    seen.add(entry['id']);
    cases.push({ id: entry['id'], prompt: entry['prompt'], baseline: entry['baseline'] });
  }
  return { name, cases };
}

function parseOutputs(body: unknown): { id: string; output: string }[] | undefined {
  if (
    !isRecord(body) ||
    !Array.isArray(body['cases']) ||
    body['cases'].length === 0 ||
    body['cases'].length > 50
  ) {
    return undefined;
  }
  const outputs: { id: string; output: string }[] = [];
  const seen = new Set<string>();
  for (const entry of body['cases']) {
    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      typeof entry['output'] !== 'string'
    ) {
      return undefined;
    }
    if (
      !/^[A-Za-z0-9_-]{1,40}$/.test(entry['id']) ||
      seen.has(entry['id']) ||
      entry['output'].length > 4_000
    ) {
      return undefined;
    }
    seen.add(entry['id']);
    outputs.push({ id: entry['id'], output: entry['output'] });
  }
  return outputs;
}

function root(message: string): Route {
  return {
    method: 'GET',
    path: '/',
    handler(ctx) {
      ctx.sendJson(200, { service: ctx.config.serviceName, message });
    },
  };
}

function remember<T>(items: Map<string, T>, id: string, value: T, limit: number): void {
  if (items.size >= limit && !items.has(id)) {
    const oldest = items.keys().next().value;
    if (oldest !== undefined) {
      items.delete(oldest);
    }
  }
  items.set(id, value);
}
