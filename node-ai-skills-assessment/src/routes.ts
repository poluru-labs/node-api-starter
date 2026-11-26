import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { assessSkills, isSkillId, skillIds } from './skills.ts';
import type { SkillReport, SkillScore } from './skills.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface SkillStore {
  save(report: SkillReport): SkillReport;
  get(id: string): SkillReport | undefined;
}

export function createSkillStore(): SkillStore {
  const reports = new Map<string, SkillReport>();
  const order: string[] = [];
  return {
    save(report) {
      remember(reports, order, report.id, report, storeLimit);
      return report;
    },
    get(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: SkillStore = createSkillStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'skills-assessment' });
      },
    },
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
          store.save(assessSkills(parsed.learner, parsed.targetLevel, parsed.scores, randomUUID())),
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
    ...createMockRoutes(loadMockSpec('node-ai-skills-assessment.json')),
  ];
}

function parseAssessment(
  body: unknown,
): { learner: string; targetLevel: number; scores: SkillScore[] } | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const learner = body['learner'];
  const targetLevel = body['targetLevel'];
  const scores = body['scores'];
  if (typeof learner !== 'string' || learner.trim().length < 1 || learner.length > 80) {
    return undefined;
  }
  if (
    typeof targetLevel !== 'number' ||
    !Number.isInteger(targetLevel) ||
    targetLevel < 1 ||
    targetLevel > 4
  ) {
    return undefined;
  }
  if (!Array.isArray(scores) || scores.length !== skillIds.length) {
    return undefined;
  }
  const parsed: SkillScore[] = [];
  for (const entry of scores) {
    if (!isRecord(entry) || !isSkillId(entry['skillId'])) {
      return undefined;
    }
    if (parsed.some((score) => score.skillId === entry['skillId'])) {
      return undefined;
    }
    const level = entry['level'];
    const evidence = entry['evidence'];
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 4) {
      return undefined;
    }
    if (typeof evidence !== 'string' || evidence.trim().length < 1 || evidence.length > 240) {
      return undefined;
    }
    parsed.push({ skillId: entry['skillId'], level, evidence: evidence.trim() });
  }
  return { learner: learner.trim(), targetLevel, scores: parsed };
}

function remember<T>(
  records: Map<string, T>,
  order: string[],
  id: string,
  value: T,
  limit: number,
): void {
  if (!records.has(id)) {
    order.push(id);
    if (order.length > limit) {
      const oldest = order.shift();
      if (oldest !== undefined) {
        records.delete(oldest);
      }
    }
  }
  records.set(id, value);
}
