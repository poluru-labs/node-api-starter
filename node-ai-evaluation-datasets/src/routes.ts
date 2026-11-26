import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isEvalSplit, isEvalTask, reviewEvaluation } from './evaluation.ts';
import type { EvalItem, EvalReport } from './evaluation.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface EvaluationStore {
  save(report: EvalReport): EvalReport;
  get(id: string): EvalReport | undefined;
}

export function createEvaluationStore(): EvaluationStore {
  const reports = new Map<string, EvalReport>();
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

export function createRoutes(store: EvaluationStore = createEvaluationStore()): readonly Route[] {
  return [
    root('Evaluation datasets is running.'),
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
        const parsed = parseEvaluation(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(reviewEvaluation(parsed.name, parsed.task, parsed.items, randomUUID())),
        );
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
    ...createMockRoutes(loadMockSpec('node-ai-evaluation-datasets.json')),
  ];
}

function parseEvaluation(
  body: unknown,
): { name: string; task: EvalReport['task']; items: EvalItem[] } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || !isEvalTask(body['task'])) {
    return undefined;
  }
  const name = body['name'].trim();
  if (name.length === 0 || name.length > 80 || !Array.isArray(body['items'])) {
    return undefined;
  }
  if (body['items'].length === 0 || body['items'].length > 500) {
    return undefined;
  }
  const items: EvalItem[] = [];
  for (const entry of body['items']) {
    const item = parseItem(entry);
    if (item === undefined) {
      return undefined;
    }
    items.push(item);
  }
  return { name, task: body['task'], items };
}

function parseItem(value: unknown): EvalItem | undefined {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['input'] !== 'string') {
    return undefined;
  }
  if (typeof value['expected'] !== 'string') {
    return undefined;
  }
  const id = value['id'].trim();
  if (
    !/^[A-Za-z0-9_-]{1,40}$/.test(id) ||
    value['input'].length > 2_000 ||
    value['expected'].length > 2_000
  ) {
    return undefined;
  }
  if (value['split'] === undefined || value['split'] === null) {
    return { id, input: value['input'], expected: value['expected'], split: null };
  }
  if (!isEvalSplit(value['split'])) {
    return undefined;
  }
  return { id, input: value['input'], expected: value['expected'], split: value['split'] };
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
