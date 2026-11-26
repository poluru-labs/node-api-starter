import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isItemKind, isTriageQueue, triageItem } from './triage.ts';
import type { IncomingItem, TriageItem, TriageQueue } from './triage.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface TriageStore {
  save(item: TriageItem): TriageItem;
  get(id: string): TriageItem | undefined;
  list(queue: TriageQueue | null): readonly TriageItem[];
}

export function createTriageStore(): TriageStore {
  const items = new Map<string, TriageItem>();
  return {
    save(item) {
      remember(items, item.id, item, storeLimit);
      return item;
    },
    get(id) {
      return items.get(id);
    },
    list(queue) {
      const all = [...items.values()].reverse();
      return (queue === null ? all : all.filter((item) => item.queue === queue)).slice(0, 50);
    },
  };
}

export function createRoutes(store: TriageStore = createTriageStore()): readonly Route[] {
  return [
    root('Open source triage is running.'),
    {
      method: 'POST',
      path: '/v1/items',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseItem(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(triageItem(store.list(null), parsed, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/items',
      handler(ctx) {
        const queue = ctx.url.searchParams.get('queue');
        if (queue === null) {
          ctx.sendJson(200, { items: store.list(null) });
          return;
        }
        if (!isTriageQueue(queue)) {
          ctx.sendJson(400, { error: 'invalid_query' });
          return;
        }
        ctx.sendJson(200, { items: store.list(queue) });
      },
    },
    {
      method: 'GET',
      path: '/v1/items/:id',
      handler(ctx) {
        const item = store.get(ctx.params['id'] ?? '');
        if (item === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, item);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-open-source-triage.json')),
  ];
}

function parseItem(body: unknown): IncomingItem | undefined {
  if (
    !isRecord(body) ||
    !isItemKind(body['kind']) ||
    typeof body['title'] !== 'string' ||
    typeof body['body'] !== 'string'
  ) {
    return undefined;
  }
  const title = body['title'].trim();
  if (title.length < 4 || title.length > 120 || body['body'].length > 10_000) {
    return undefined;
  }
  const hasReproduction = optionalFlag(body['hasReproduction']);
  const hasTest = optionalFlag(body['hasTest']);
  if (hasReproduction === 'invalid' || hasTest === 'invalid') {
    return undefined;
  }
  return { kind: body['kind'], title, body: body['body'], hasReproduction, hasTest };
}

function optionalFlag(value: unknown): boolean | null | 'invalid' {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'boolean') {
    return 'invalid';
  }
  return value;
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
