import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { exploreFiles } from './explorer.ts';
import type { ExplorationReport, SourceFile } from './explorer.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 100;

export interface ExplorerStore {
  save(report: ExplorationReport): ExplorationReport;
  get(id: string): ExplorationReport | undefined;
}

export function createExplorerStore(): ExplorerStore {
  const reports = new Map<string, ExplorationReport>();
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

export function createRoutes(store: ExplorerStore = createExplorerStore()): readonly Route[] {
  return [
    root('Legacy code explorer is running.'),
    {
      method: 'POST',
      path: '/v1/explorations',
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
        ctx.sendJson(201, store.save(exploreFiles(files, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/explorations/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-legacy-code-explorer.json')),
  ];
}

function parseFiles(body: unknown): SourceFile[] | undefined {
  if (
    !isRecord(body) ||
    !Array.isArray(body['files']) ||
    body['files'].length === 0 ||
    body['files'].length > 20
  ) {
    return undefined;
  }
  const files: SourceFile[] = [];
  for (const entry of body['files']) {
    if (
      !isRecord(entry) ||
      typeof entry['content'] !== 'string' ||
      entry['content'].length > 100_000
    ) {
      return undefined;
    }
    const path = safePath(entry['path']);
    if (path === undefined) {
      return undefined;
    }
    files.push({ path, content: entry['content'] });
  }
  return files;
}

function safePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
    return undefined;
  }
  if (value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) {
    return undefined;
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
