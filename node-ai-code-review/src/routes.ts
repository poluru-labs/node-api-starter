import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { reviewFiles } from './review.ts';
import type { ReviewReport } from './review.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface ReviewStore {
  save(report: ReviewReport): ReviewReport;
  get(id: string): ReviewReport | undefined;
}

export function createReviewStore(): ReviewStore {
  const reports = new Map<string, ReviewReport>();
  return {
    save(report) {
      if (reports.size >= storeLimit && !reports.has(report.id)) {
        const oldest = reports.keys().next().value;
        if (oldest !== undefined) {
          reports.delete(oldest);
        }
      }
      reports.set(report.id, report);
      return report;
    },
    get(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: ReviewStore = createReviewStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: ctx.config.serviceName, message: 'Code review is running.' });
      },
    },
    {
      method: 'POST',
      path: '/v1/reviews',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const files = isRecord(body) ? parseFiles(body['files']) : undefined;
        if (files === undefined) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(201, store.save(reviewFiles(files, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/reviews/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-code-review.json')),
  ];
}

function parseFiles(value: unknown): { path: string; content: string }[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    return undefined;
  }
  const files: { path: string; content: string }[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item['path'] !== 'string' ||
      typeof item['content'] !== 'string'
    ) {
      return undefined;
    }
    if (!isSafePath(item['path']) || item['content'].length > 100_000) {
      return undefined;
    }
    files.push({ path: item['path'], content: item['content'] });
  }
  return files;
}

function isSafePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 200 &&
    !path.startsWith('/') &&
    !path.split('/').includes('..')
  );
}
