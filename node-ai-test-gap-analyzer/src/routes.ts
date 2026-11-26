import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { analyzeGaps } from './gaps.ts';
import type { GapReport, SourceFile } from './gaps.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 100;
const maxFiles = 30;
const maxContent = 100_000;

export interface GapStore {
  save(report: GapReport): GapReport;
  get(id: string): GapReport | undefined;
}

export function createGapStore(): GapStore {
  const reports = new Map<string, GapReport>();
  const order: string[] = [];
  return {
    save(report) {
      remember(reports, order, report.id, report, storeLimit);
      return report;
    },
    get(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: GapStore = createGapStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'test-gap-analyzer' });
      },
    },
    {
      method: 'POST',
      path: '/v1/analyses',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const files = parseFiles(body);
        if (files === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(analyzeGaps(files, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/analyses/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-test-gap-analyzer.json')),
  ];
}

function parseFiles(body: unknown): SourceFile[] | undefined {
  if (!isRecord(body) || !Array.isArray(body['files'])) {
    return undefined;
  }
  if (body['files'].length < 1 || body['files'].length > maxFiles) {
    return undefined;
  }
  const files: SourceFile[] = [];
  for (const entry of body['files']) {
    if (
      !isRecord(entry) ||
      typeof entry['path'] !== 'string' ||
      typeof entry['content'] !== 'string'
    ) {
      return undefined;
    }
    if (!isRelativePath(entry['path']) || entry['content'].length > maxContent) {
      return undefined;
    }
    if (files.some((file) => file.path === entry['path'])) {
      return undefined;
    }
    files.push({ path: entry['path'], content: entry['content'] });
  }
  return files;
}

function isRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 200 &&
    !path.startsWith('/') &&
    !path.split('/').includes('..')
  );
}

function remember<T>(
  records: Map<string, T>,
  order: string[],
  id: string,
  value: T,
  limit: number,
): void {
  if (!records.has(id)) {
    order.push(id);
    if (order.length > limit) {
      const oldest = order.shift();
      if (oldest !== undefined) {
        records.delete(oldest);
      }
    }
  }
  records.set(id, value);
}
