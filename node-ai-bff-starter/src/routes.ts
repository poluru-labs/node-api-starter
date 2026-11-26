import type { Route } from './app.ts';
import { compose, isResourceKey } from './bff.ts';
import type { ResourceDocument, ScreenView, ViewPart } from './bff.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

export interface BffStore {
  saveResource(document: ResourceDocument): ResourceDocument;
  saveView(view: ScreenView): ScreenView;
  resource(key: string): ResourceDocument | undefined;
  view(name: string): ScreenView | undefined;
  resources(): ReadonlyMap<string, ResourceDocument>;
}

export function createBffStore(): BffStore {
  const resources = new Map<string, ResourceDocument>();
  const views = new Map<string, ScreenView>();
  return {
    saveResource(document) {
      resources.set(document.key, document);
      return document;
    },
    saveView(view) {
      views.set(view.name, view);
      return view;
    },
    resource(key) {
      return resources.get(key);
    },
    view(name) {
      return views.get(name);
    },
    resources() {
      return resources;
    },
  };
}

export function createRoutes(store: BffStore = createBffStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: ctx.config.serviceName, message: 'BFF starter is running.' });
      },
    },
    {
      method: 'PUT',
      path: '/v1/resources/:key',
      async handler(ctx) {
        const key = ctx.params['key'] ?? '';
        if (!isResourceKey(key)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined || !isRecord(body) || !('data' in body)) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(200, store.saveResource({ key, data: body['data'] }));
      },
    },
    {
      method: 'PUT',
      path: '/v1/views/:name',
      async handler(ctx) {
        const name = ctx.params['name'] ?? '';
        if (!isResourceKey(name)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parts = isRecord(body) ? parseParts(body['parts']) : undefined;
        if (parts === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(200, store.saveView({ name, parts }));
      },
    },
    {
      method: 'GET',
      path: '/v1/views/:name',
      handler(ctx) {
        const view = store.view(ctx.params['name'] ?? '');
        if (view === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, compose(view, store.resources()));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-bff-starter.json')),
  ];
}

function parseParts(value: unknown): ViewPart[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    return undefined;
  }
  const parts: ViewPart[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || !isResourceKey(item['key'])) {
      return undefined;
    }
    if (seen.has(item['key'])) {
      return undefined;
    }
    seen.add(item['key']);
    const required = item['required'] === undefined ? true : item['required'];
    if (typeof required !== 'boolean') {
      return undefined;
    }
    parts.push({ key: item['key'], required });
  }
  return parts;
}
