import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { assessFairness } from './fairness.ts';
import type { FairnessReport, FairnessRow } from './fairness.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface FairnessStore {
  save(report: FairnessReport): FairnessReport;
  get(id: string): FairnessReport | undefined;
}

export function createFairnessStore(): FairnessStore {
  const reports = new Map<string, FairnessReport>();
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

export function createRoutes(store: FairnessStore = createFairnessStore()): readonly Route[] {
  return [
    root('Fairness testing is running.'),
    {
      method: 'POST',
      path: '/v1/assessments',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseAssessment(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(assessFairness(parsed.protectedAttribute, parsed.rows, randomUUID())),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/assessments/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-fairness-testing.json')),
  ];
}

function parseAssessment(
  body: unknown,
): { protectedAttribute: string; rows: FairnessRow[] } | undefined {
  if (
    !isRecord(body) ||
    typeof body['protectedAttribute'] !== 'string' ||
    !Array.isArray(body['rows'])
  ) {
    return undefined;
  }
  const protectedAttribute = body['protectedAttribute'].trim();
  if (
    protectedAttribute.length === 0 ||
    protectedAttribute.length > 40 ||
    body['rows'].length === 0 ||
    body['rows'].length > 2_000
  ) {
    return undefined;
  }
  const rows: FairnessRow[] = [];
  for (const entry of body['rows']) {
    const row = parseRow(entry);
    if (row === undefined) {
      return undefined;
    }
    rows.push(row);
  }
  return { protectedAttribute, rows };
}

function parseRow(value: unknown): FairnessRow | undefined {
  if (!isRecord(value) || typeof value['group'] !== 'string') {
    return undefined;
  }
  const group = value['group'].trim();
  if (
    group.length === 0 ||
    group.length > 40 ||
    !isBit(value['label']) ||
    !isBit(value['prediction'])
  ) {
    return undefined;
  }
  return { group, label: value['label'], prediction: value['prediction'] };
}

function isBit(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
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
