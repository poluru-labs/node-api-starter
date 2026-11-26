import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isAudience, rewritePlain } from './plain.ts';
import type { PlainReport } from './plain.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface PlainStore {
  save(report: PlainReport): PlainReport;
  get(id: string): PlainReport | undefined;
}

export function createPlainStore(): PlainStore {
  const reports = new Map<string, PlainReport>();
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

export function createRoutes(store: PlainStore = createPlainStore()): readonly Route[] {
  return [
    root('Plain language is running.'),
    {
      method: 'POST',
      path: '/v1/plain-language',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const audience =
          isRecord(body) && body['audience'] === undefined
            ? 'general'
            : isRecord(body)
              ? body['audience']
              : undefined;
        if (
          !isRecord(body) ||
          typeof body['text'] !== 'string' ||
          body['text'].trim().length === 0 ||
          body['text'].length > 8_000 ||
          !isAudience(audience)
        ) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(201, store.save(rewritePlain(body['text'], audience, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/plain-language/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-plain-language-api.json')),
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
