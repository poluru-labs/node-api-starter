import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { screenStudy, summarizeReview } from './review.ts';
import type { ReviewProtocol, StudyRecord } from './review.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 100;

export interface ReviewStore {
  save(review: ReviewProtocol): ReviewProtocol;
  get(id: string): ReviewProtocol | undefined;
}

export function createReviewStore(): ReviewStore {
  const reviews = new Map<string, ReviewProtocol>();
  const order: string[] = [];
  return {
    save(review) {
      remember(reviews, order, review.id, review, storeLimit);
      return review;
    },
    get(id) {
      return reviews.get(id);
    },
  };
}

export function createRoutes(store: ReviewStore = createReviewStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'systematic-review' });
      },
    },
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
        const review = store.save({ id: randomUUID(), ...parsed, studies: [] });
        ctx.sendJson(201, { ...review, summary: summarizeReview(review) });
      },
    },
    {
      method: 'POST',
      path: '/v1/reviews/:id/studies',
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
        const parsed = parseStudy(body);
        if (parsed === undefined || current.studies.length >= 200) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const screened = screenStudy(
          parsed.title,
          parsed.abstract,
          current.includeTerms,
          current.excludeTerms,
        );
        const study: StudyRecord = {
          id: randomUUID(),
          title: parsed.title,
          year: parsed.year,
          decision: screened.decision,
          reasons: screened.reasons,
        };
        const next = store.save({ ...current, studies: [...current.studies, study] });
        ctx.sendJson(201, { study, summary: summarizeReview(next) });
      },
    },
    {
      method: 'GET',
      path: '/v1/reviews/:id',
      handler(ctx) {
        const review = store.get(ctx.params['id'] ?? '');
        if (review === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, { ...review, summary: summarizeReview(review) });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-systematic-review.json')),
  ];
}

function parseReview(
  body: unknown,
): Pick<ReviewProtocol, 'question' | 'includeTerms' | 'excludeTerms'> | undefined {
  if (!isRecord(body) || typeof body['question'] !== 'string') {
    return undefined;
  }
  const question = body['question'].trim();
  if (question.length < 12 || question.length > 240) {
    return undefined;
  }
  const includeTerms = terms(body['includeTerms']);
  const excludeTerms = terms(body['excludeTerms']);
  if (includeTerms === undefined || excludeTerms === undefined) {
    return undefined;
  }
  return { question, includeTerms, excludeTerms };
}

function parseStudy(body: unknown): { title: string; abstract: string; year: number } | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const title = body['title'];
  const abstract = body['abstract'];
  const year = body['year'];
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 200) {
    return undefined;
  }
  if (typeof abstract !== 'string' || abstract.trim().length < 12 || abstract.length > 4_000) {
    return undefined;
  }
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 2100) {
    return undefined;
  }
  return { title: title.trim(), abstract: abstract.trim(), year };
}

function terms(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
    return undefined;
  }
  const parsed: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      return undefined;
    }
    const term = entry.trim().toLowerCase();
    if (term.length < 3 || term.length > 40 || parsed.includes(term)) {
      return undefined;
    }
    parsed.push(term);
  }
  return parsed;
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
