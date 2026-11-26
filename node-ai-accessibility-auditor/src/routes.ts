import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { buildAudit, isConformanceLevel } from './audit.ts';
import type { AuditReport } from './audit.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 1_000;

export interface AuditStore {
  save(report: AuditReport): AuditReport;
  get(id: string): AuditReport | undefined;
}

export function createAuditStore(): AuditStore {
  const reports = new Map<string, AuditReport>();
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

export function createRoutes(store: AuditStore = createAuditStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Accessibility auditor is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/audits',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body) || typeof body['html'] !== 'string' || body['html'].trim() === '') {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (body['html'].length > 200_000) {
          ctx.sendJson(413, { error: 'payload_too_large' });
          return;
        }
        const level = body['level'] === undefined ? 'AA' : body['level'];
        if (!isConformanceLevel(level)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const report = store.save(
          buildAudit(body['html'], level, randomUUID(), new Date().toISOString()),
        );
        ctx.sendJson(201, report);
      },
    },
    {
      method: 'GET',
      path: '/v1/audits/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-accessibility-auditor.json')),
  ];
}
