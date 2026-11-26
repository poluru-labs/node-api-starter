import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { corpusAgreement, taskAgreement } from './agreement.ts';
import type { Judgment, ReviewTask } from './agreement.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 1_000;

export interface ReviewStore {
  save(task: ReviewTask): ReviewTask;
  get(id: string): ReviewTask | undefined;
  list(): ReviewTask[];
}

export function createReviewStore(): ReviewStore {
  const tasks = new Map<string, ReviewTask>();
  return {
    save(task) {
      if (tasks.size >= storeLimit && !tasks.has(task.id)) {
        const oldest = tasks.keys().next().value;
        if (oldest !== undefined) {
          tasks.delete(oldest);
        }
      }
      tasks.set(task.id, task);
      return task;
    },
    get(id) {
      return tasks.get(id);
    },
    list() {
      return [...tasks.values()];
    },
  };
}

export function createRoutes(store: ReviewStore = createReviewStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Annotation review is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/tasks',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const created = parseTask(body);
        if (created === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...created, judgments: [] }));
      },
    },
    {
      method: 'POST',
      path: '/v1/tasks/:id/judgments',
      async handler(ctx) {
        const current = store.get(ctx.params['id'] ?? '');
        if (current === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const judgment = parseJudgment(body, current.allowedLabels);
        if (judgment === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const judgments = [
          ...current.judgments.filter((item) => item.annotatorId !== judgment.annotatorId),
          judgment,
        ];
        const task = store.save({ ...current, judgments });
        ctx.sendJson(201, { task, agreement: taskAgreement(task) });
      },
    },
    {
      method: 'GET',
      path: '/v1/tasks/:id',
      handler(ctx) {
        const task = store.get(ctx.params['id'] ?? '');
        if (task === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, { task, agreement: taskAgreement(task) });
      },
    },
    {
      method: 'GET',
      path: '/v1/agreement',
      handler(ctx) {
        ctx.sendJson(200, corpusAgreement(store.list()));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-annotation-review.json')),
  ];
}

function parseTask(body: unknown): { itemId: string; allowedLabels: string[] } | undefined {
  if (!isRecord(body) || typeof body['itemId'] !== 'string' || body['itemId'].trim() === '') {
    return undefined;
  }
  if (!Array.isArray(body['allowedLabels'])) {
    return undefined;
  }
  const allowedLabels = [
    ...new Set(
      body['allowedLabels'].filter(
        (label): label is string => typeof label === 'string' && label.trim() !== '',
      ),
    ),
  ].map((label) => label.trim());
  if (allowedLabels.length < 2 || allowedLabels.length > 20 || body['itemId'].trim().length > 120) {
    return undefined;
  }
  return { itemId: body['itemId'].trim(), allowedLabels };
}

function parseJudgment(body: unknown, allowed: readonly string[]): Judgment | undefined {
  if (
    !isRecord(body) ||
    typeof body['annotatorId'] !== 'string' ||
    typeof body['label'] !== 'string'
  ) {
    return undefined;
  }
  const annotatorId = body['annotatorId'].trim();
  const label = body['label'].trim();
  if (annotatorId.length === 0 || annotatorId.length > 80 || !allowed.includes(label)) {
    return undefined;
  }
  return { annotatorId, label };
}
