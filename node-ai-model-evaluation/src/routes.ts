import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { evaluateClassification, evaluateRegression, isEvalTask } from './evaluation.ts';
import type { ModelEvalReport } from './evaluation.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface ModelEvalStore {
  save(report: ModelEvalReport): ModelEvalReport;
  get(id: string): ModelEvalReport | undefined;
}

export function createModelEvalStore(): ModelEvalStore {
  const reports = new Map<string, ModelEvalReport>();
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

export function createRoutes(store: ModelEvalStore = createModelEvalStore()): readonly Route[] {
  return [
    root('Model evaluation is running.'),
    {
      method: 'POST',
      path: '/v1/evaluations',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const report = buildReport(body);
        if (report === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(report));
      },
    },
    {
      method: 'GET',
      path: '/v1/evaluations/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-model-evaluation.json')),
  ];
}

function buildReport(body: unknown): ModelEvalReport | undefined {
  if (!isRecord(body) || !isEvalTask(body['task']) || !Array.isArray(body['rows'])) {
    return undefined;
  }
  if (body['rows'].length === 0 || body['rows'].length > 2_000) {
    return undefined;
  }
  const id = randomUUID();
  if (body['task'] === 'classification') {
    const rows: { expected: string; predicted: string }[] = [];
    for (const entry of body['rows']) {
      if (!isRecord(entry) || !isLabel(entry['expected']) || !isLabel(entry['predicted'])) {
        return undefined;
      }
      rows.push({ expected: entry['expected'].trim(), predicted: entry['predicted'].trim() });
    }
    return evaluateClassification(rows, id);
  }
  const rows: { expected: number; predicted: number }[] = [];
  for (const entry of body['rows']) {
    if (!isRecord(entry) || !isMeasure(entry['expected']) || !isMeasure(entry['predicted'])) {
      return undefined;
    }
    rows.push({ expected: entry['expected'], predicted: entry['predicted'] });
  }
  return evaluateRegression(rows, id);
}

function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40;
}

function isMeasure(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12;
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
