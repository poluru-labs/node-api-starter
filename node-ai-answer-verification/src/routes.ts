import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { verifyAnswer } from './verify.ts';
import type { Source, Verification } from './verify.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface VerificationStore {
  save(report: Verification): Verification;
  get(id: string): Verification | undefined;
}

export function createVerificationStore(): VerificationStore {
  const reports = new Map<string, Verification>();
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

export function createRoutes(
  store: VerificationStore = createVerificationStore(),
): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Answer verification is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/verifications',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseRequest(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const report = store.save(
          verifyAnswer({
            id: randomUUID(),
            question: parsed.question,
            answer: parsed.answer,
            sources: parsed.sources,
          }),
        );
        ctx.sendJson(201, report);
      },
    },
    {
      method: 'GET',
      path: '/v1/verifications/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-answer-verification.json')),
  ];
}

function parseRequest(
  body: unknown,
): { question: string; answer: string; sources: Source[] } | undefined {
  if (
    !isRecord(body) ||
    !isText(body['question']) ||
    !isText(body['answer']) ||
    !Array.isArray(body['sources'])
  ) {
    return undefined;
  }
  if (body['sources'].length === 0 || body['sources'].length > 20) {
    return undefined;
  }
  const sources: Source[] = [];
  for (const source of body['sources']) {
    if (!isRecord(source) || !isText(source['id']) || !isText(source['text'])) {
      return undefined;
    }
    if (source['id'].trim().length > 80 || source['text'].length > 20_000) {
      return undefined;
    }
    sources.push({ id: source['id'].trim(), text: source['text'].trim() });
  }
  return { question: body['question'].trim(), answer: body['answer'].trim(), sources };
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
