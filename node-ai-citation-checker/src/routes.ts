import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { checkCitations, parseReferences } from './citations.ts';
import type { CitationReport } from './citations.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface CitationStore {
  save(report: CitationReport): CitationReport;
  get(id: string): CitationReport | undefined;
}

export function createCitationStore(): CitationStore {
  const reports = new Map<string, CitationReport>();
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

export function createRoutes(store: CitationStore = createCitationStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Citation checker is running.',
        });
      },
    },
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
          typeof body['text'] !== 'string' ||
          body['text'].trim().length === 0
        ) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (body['text'].length > 100_000) {
          ctx.sendJson(413, { error: 'payload_too_large' });
          return;
        }
        const references = parseReferences(body['references']);
        if (references === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(checkCitations(body['text'], references, randomUUID())));
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
    ...createMockRoutes(loadMockSpec('node-ai-citation-checker.json')),
  ];
}
