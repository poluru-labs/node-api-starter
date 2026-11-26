import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { analyzeReading } from './reading.ts';
import type { ReadingReport } from './reading.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface ReadingStore {
  save(report: ReadingReport): ReadingReport;
  get(id: string): ReadingReport | undefined;
}

export function createReadingStore(): ReadingStore {
  const reports = new Map<string, ReadingReport>();
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

export function createRoutes(store: ReadingStore = createReadingStore()): readonly Route[] {
  return [
    root('Assistive reading is running.'),
    {
      method: 'POST',
      path: '/v1/readings',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined || !isRecord(body) || !isPassage(body['text'])) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        const target = body['targetGrade'];
        if (
          target !== undefined &&
          (typeof target !== 'number' || !Number.isInteger(target) || target < 1 || target > 16)
        ) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const report = store.save(
          analyzeReading(body['text'].trim(), target ?? null, randomUUID()),
        );
        ctx.sendJson(201, report);
      },
    },
    {
      method: 'GET',
      path: '/v1/readings/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-assistive-reading.json')),
  ];
}

function isPassage(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 20_000;
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
