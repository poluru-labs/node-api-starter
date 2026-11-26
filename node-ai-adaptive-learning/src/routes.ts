import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { applyAttempt, emptyMastery, isSkillId, recommend } from './learning.ts';
import type { Learner, SkillId } from './learning.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 1_000;

export interface LearnerStore {
  save(learner: Learner): Learner;
  get(id: string): Learner | undefined;
}

export function createLearnerStore(): LearnerStore {
  const learners = new Map<string, Learner>();
  return {
    save(learner) {
      if (learners.size >= storeLimit && !learners.has(learner.id)) {
        const oldest = learners.keys().next().value;
        if (oldest !== undefined) {
          learners.delete(oldest);
        }
      }
      learners.set(learner.id, learner);
      return learner;
    },
    get(id) {
      return learners.get(id);
    },
  };
}

export function createRoutes(store: LearnerStore = createLearnerStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Adaptive learning is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/learners',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body) || !isName(body['name'])) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const learner = store.save({
          id: randomUUID(),
          name: body['name'].trim(),
          attempts: 0,
          mastery: emptyMastery(),
        });
        ctx.sendJson(201, learner);
      },
    },
    {
      method: 'POST',
      path: '/v1/learners/:id/attempts',
      async handler(ctx) {
        const learner = store.get(ctx.params['id'] ?? '');
        if (learner === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const attempt = parseAttempt(body);
        if (attempt === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const mastery: Record<SkillId, number> = { ...learner.mastery };
        mastery[attempt.skillId] = applyAttempt(mastery[attempt.skillId], attempt);
        const updated = store.save({
          ...learner,
          attempts: learner.attempts + 1,
          mastery,
        });
        ctx.sendJson(200, { learner: updated, recommendation: recommend(updated) });
      },
    },
    {
      method: 'GET',
      path: '/v1/learners/:id/next',
      handler(ctx) {
        const learner = store.get(ctx.params['id'] ?? '');
        if (learner === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, recommend(learner));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-adaptive-learning.json')),
  ];
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80;
}

function parseAttempt(
  body: unknown,
): { skillId: SkillId; correct: boolean; difficulty: number } | undefined {
  if (!isRecord(body) || !isSkillId(body['skillId']) || typeof body['correct'] !== 'boolean') {
    return undefined;
  }
  const difficulty = body['difficulty'];
  if (
    typeof difficulty !== 'number' ||
    !Number.isInteger(difficulty) ||
    difficulty < 1 ||
    difficulty > 5
  ) {
    return undefined;
  }
  return { skillId: body['skillId'], correct: body['correct'], difficulty };
}
