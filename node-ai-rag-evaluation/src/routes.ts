import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { evaluateRag } from './rag.ts';
import type { RagContext, RagReport } from './rag.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface RagStore {
  save(report: RagReport): RagReport;
  get(id: string): RagReport | undefined;
}

export function createRagStore(): RagStore {
  const reports = new Map<string, RagReport>();
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

export function createRoutes(store: RagStore = createRagStore()): readonly Route[] {
  return [
    root('RAG evaluation is running.'),
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
          store.save(evaluateRag(parsed.question, parsed.answer, parsed.contexts, randomUUID())),
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
    ...createMockRoutes(loadMockSpec('node-ai-rag-evaluation.json')),
  ];
}

function parseEvaluation(
  body: unknown,
): { question: string; answer: string; contexts: RagContext[] } | undefined {
  if (
    !isRecord(body) ||
    typeof body['question'] !== 'string' ||
    typeof body['answer'] !== 'string'
  ) {
    return undefined;
  }
  const question = body['question'].trim();
  if (
    question.length === 0 ||
    question.length > 500 ||
    body['answer'].length === 0 ||
    body['answer'].length > 4_000
  ) {
    return undefined;
  }
  if (
    !Array.isArray(body['contexts']) ||
    body['contexts'].length === 0 ||
    body['contexts'].length > 10
  ) {
    return undefined;
  }
  const contexts: RagContext[] = [];
  const seen = new Set<string>();
  for (const entry of body['contexts']) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || typeof entry['text'] !== 'string') {
      return undefined;
    }
    if (
      !/^[A-Za-z0-9_.:-]{1,40}$/.test(entry['id']) ||
      seen.has(entry['id']) ||
      entry['text'].trim().length === 0 ||
      entry['text'].length > 4_000
    ) {
      return undefined;
    }
    seen.add(entry['id']);
    contexts.push({ id: entry['id'], text: entry['text'] });
  }
  return { question, answer: body['answer'], contexts };
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
