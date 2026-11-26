import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { checkDocumentation, isDocKind } from './docs.ts';
import type { DocReport } from './docs.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface DocStore {
  save(report: DocReport): DocReport;
  get(id: string): DocReport | undefined;
}

export function createDocStore(): DocStore {
  const reports = new Map<string, DocReport>();
  return {
    save(report) {
      remember(reports, report.id, report, storeLimit);
      return report;
    },
    get(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: DocStore = createDocStore()): readonly Route[] {
  return [
    root('Documentation checker is running.'),
    {
      method: 'POST',
      path: '/v1/checks',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (
          !isRecord(body) ||
          !isDocKind(body['kind']) ||
          typeof body['text'] !== 'string' ||
          body['text'].trim().length === 0 ||
          body['text'].length > 100_000
        ) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(201, store.save(checkDocumentation(body['kind'], body['text'], randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/checks/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-documentation-checker.json')),
  ];
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
