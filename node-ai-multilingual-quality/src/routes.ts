import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { reviewTranslation } from './quality.ts';
import type { QualityReport, Segment } from './quality.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface QualityStore {
  save(report: QualityReport): QualityReport;
  get(id: string): QualityReport | undefined;
}

export function createQualityStore(): QualityStore {
  const reports = new Map<string, QualityReport>();
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

export function createRoutes(store: QualityStore = createQualityStore()): readonly Route[] {
  return [
    root('Multilingual quality is running.'),
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
        const parsed = parseReview(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(
            reviewTranslation(
              parsed.sourceLocale,
              parsed.targetLocale,
              parsed.segments,
              randomUUID(),
            ),
          ),
        );
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
    ...createMockRoutes(loadMockSpec('node-ai-multilingual-quality.json')),
  ];
}

function parseReview(
  body: unknown,
): { sourceLocale: string; targetLocale: string; segments: Segment[] } | undefined {
  if (!isRecord(body) || !isLocale(body['sourceLocale']) || !isLocale(body['targetLocale'])) {
    return undefined;
  }
  if (
    !Array.isArray(body['segments']) ||
    body['segments'].length === 0 ||
    body['segments'].length > 50
  ) {
    return undefined;
  }
  const segments: Segment[] = [];
  const seen = new Set<string>();
  for (const entry of body['segments']) {
    const segment = parseSegment(entry);
    if (segment === undefined || seen.has(segment.id)) {
      return undefined;
    }
    seen.add(segment.id);
    segments.push(segment);
  }
  return { sourceLocale: body['sourceLocale'], targetLocale: body['targetLocale'], segments };
}

function parseSegment(value: unknown): Segment | undefined {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['source'] !== 'string' ||
    typeof value['target'] !== 'string'
  ) {
    return undefined;
  }
  if (
    !/^[A-Za-z0-9_-]{1,40}$/.test(value['id']) ||
    value['source'].length > 2_000 ||
    value['target'].length > 2_000
  ) {
    return undefined;
  }
  return { id: value['id'], source: value['source'], target: value['target'] };
}

function isLocale(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);
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
