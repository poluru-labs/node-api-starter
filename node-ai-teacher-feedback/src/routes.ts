import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { buildFeedback } from './feedback.ts';
import type { Assignment, CriterionScore, FeedbackReport, RubricCriterion } from './feedback.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface FeedbackStore {
  saveAssignment(assignment: Assignment): Assignment;
  getAssignment(id: string): Assignment | undefined;
  saveFeedback(report: FeedbackReport): FeedbackReport;
  getFeedback(id: string): FeedbackReport | undefined;
}

export function createFeedbackStore(): FeedbackStore {
  const assignments = new Map<string, Assignment>();
  const reports = new Map<string, FeedbackReport>();
  const assignmentOrder: string[] = [];
  const reportOrder: string[] = [];
  return {
    saveAssignment(assignment) {
      remember(assignments, assignmentOrder, assignment.id, assignment, storeLimit);
      return assignment;
    },
    getAssignment(id) {
      return assignments.get(id);
    },
    saveFeedback(report) {
      remember(reports, reportOrder, report.id, report, storeLimit);
      return report;
    },
    getFeedback(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: FeedbackStore = createFeedbackStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'teacher-feedback' });
      },
    },
    {
      method: 'POST',
      path: '/v1/assignments',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseAssignment(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.saveAssignment({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'POST',
      path: '/v1/assignments/:id/feedback',
      async handler(ctx) {
        const assignment = store.getAssignment(ctx.params['id'] ?? '');
        if (assignment === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseSubmission(body, assignment);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.saveFeedback(
            buildFeedback(assignment, parsed.student, parsed.scores, randomUUID()),
          ),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/feedback/:id',
      handler(ctx) {
        const report = store.getFeedback(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-teacher-feedback.json')),
  ];
}

function parseAssignment(body: unknown): Pick<Assignment, 'title' | 'criteria'> | undefined {
  if (!isRecord(body) || typeof body['title'] !== 'string' || !Array.isArray(body['criteria'])) {
    return undefined;
  }
  const title = body['title'].trim();
  if (
    title.length < 3 ||
    title.length > 120 ||
    body['criteria'].length < 1 ||
    body['criteria'].length > 8
  ) {
    return undefined;
  }
  const criteria: RubricCriterion[] = [];
  for (const entry of body['criteria']) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || typeof entry['name'] !== 'string') {
      return undefined;
    }
    if (
      !/^[a-z][a-z0-9-]{0,31}$/.test(entry['id']) ||
      criteria.some((item) => item.id === entry['id'])
    ) {
      return undefined;
    }
    const name = entry['name'].trim();
    const maxPoints = entry['maxPoints'];
    if (name.length < 1 || name.length > 80) {
      return undefined;
    }
    if (
      typeof maxPoints !== 'number' ||
      !Number.isInteger(maxPoints) ||
      maxPoints < 1 ||
      maxPoints > 20
    ) {
      return undefined;
    }
    criteria.push({ id: entry['id'], name, maxPoints });
  }
  return { title, criteria };
}

function parseSubmission(
  body: unknown,
  assignment: Assignment,
): { student: string; scores: CriterionScore[] } | undefined {
  if (!isRecord(body) || typeof body['student'] !== 'string' || !Array.isArray(body['scores'])) {
    return undefined;
  }
  const student = body['student'].trim();
  if (
    student.length < 1 ||
    student.length > 80 ||
    body['scores'].length !== assignment.criteria.length
  ) {
    return undefined;
  }
  const scores: CriterionScore[] = [];
  for (const entry of body['scores']) {
    if (
      !isRecord(entry) ||
      typeof entry['criterionId'] !== 'string' ||
      typeof entry['note'] !== 'string'
    ) {
      return undefined;
    }
    const criterion = assignment.criteria.find((item) => item.id === entry['criterionId']);
    const points = entry['points'];
    if (
      criterion === undefined ||
      scores.some((score) => score.criterionId === entry['criterionId'])
    ) {
      return undefined;
    }
    if (
      typeof points !== 'number' ||
      !Number.isInteger(points) ||
      points < 0 ||
      points > criterion.maxPoints
    ) {
      return undefined;
    }
    if (entry['note'].trim().length < 1 || entry['note'].length > 240) {
      return undefined;
    }
    scores.push({ criterionId: entry['criterionId'], points, note: entry['note'].trim() });
  }
  return { student, scores };
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
