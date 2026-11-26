import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isEventKind, nextStatus, redactAttributes, summarize } from './traces.ts';
import type { AgentRun, TraceEvent } from './traces.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;
const listLimit = 50;

export interface TraceStore {
  save(run: AgentRun): AgentRun;
  get(id: string): AgentRun | undefined;
  list(): AgentRun[];
}

export function createTraceStore(): TraceStore {
  const runs = new Map<string, AgentRun>();
  return {
    save(run) {
      if (runs.size >= storeLimit && !runs.has(run.id)) {
        const oldest = runs.keys().next().value;
        if (oldest !== undefined) {
          runs.delete(oldest);
        }
      }
      runs.set(run.id, run);
      return run;
    },
    get(id) {
      return runs.get(id);
    },
    list() {
      return [...runs.values()];
    },
  };
}

export function createRoutes(store: TraceStore = createTraceStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Agent observability is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/runs',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body) || !isShortText(body['agent'])) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const run = store.save({
          id: randomUUID(),
          agent: body['agent'].trim(),
          status: 'running',
          startedAt: new Date().toISOString(),
          events: [],
        });
        ctx.sendJson(201, { ...summarize(run), events: run.events });
      },
    },
    {
      method: 'GET',
      path: '/v1/runs',
      handler(ctx) {
        const runs = store
          .list()
          .slice(-listLimit)
          .reverse()
          .map((run) => summarize(run));
        ctx.sendJson(200, { runs });
      },
    },
    {
      method: 'POST',
      path: '/v1/runs/:id/events',
      async handler(ctx) {
        const current = store.get(ctx.params['id'] ?? '');
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
        const event = parseEvent(body);
        if (event === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const complete = isRecord(body) && body['complete'] === true;
        const run = store.save({
          ...current,
          status: nextStatus(current.status, event.status, complete),
          events: [...current.events, event],
        });
        ctx.sendJson(201, { ...summarize(run), events: run.events });
      },
    },
    {
      method: 'GET',
      path: '/v1/runs/:id',
      handler(ctx) {
        const run = store.get(ctx.params['id'] ?? '');
        if (run === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, { ...summarize(run), events: run.events });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-agent-observability.json')),
  ];
}

function parseEvent(body: unknown): TraceEvent | undefined {
  if (!isRecord(body) || !isEventKind(body['kind']) || !isShortText(body['name'])) {
    return undefined;
  }
  if (body['status'] !== 'ok' && body['status'] !== 'error') {
    return undefined;
  }
  if (!isWholeNumber(body['durationMs'])) {
    return undefined;
  }
  const tokens = body['tokens'] === undefined ? 0 : body['tokens'];
  if (!isWholeNumber(tokens)) {
    return undefined;
  }
  return {
    id: randomUUID(),
    kind: body['kind'],
    name: body['name'].trim(),
    status: body['status'],
    durationMs: body['durationMs'],
    tokens,
    attributes: redactAttributes(body['attributes']),
  };
}

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3_600_000;
}
