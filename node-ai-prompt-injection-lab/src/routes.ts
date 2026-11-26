import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isChannel, scanText } from './scan.ts';
import type { ScanReport } from './scan.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface ScanStore {
  save(report: ScanReport): ScanReport;
  get(id: string): ScanReport | undefined;
}

export function createScanStore(): ScanStore {
  const reports = new Map<string, ScanReport>();
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

export function createRoutes(store: ScanStore = createScanStore()): readonly Route[] {
  return [
    root('Prompt injection lab is running.'),
    {
      method: 'POST',
      path: '/v1/scans',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (
          !isRecord(body) ||
          !isChannel(body['channel']) ||
          typeof body['text'] !== 'string' ||
          body['text'].trim().length === 0 ||
          body['text'].length > 8_000
        ) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(201, store.save(scanText(body['channel'], body['text'], randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/scans/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-prompt-injection-lab.json')),
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
