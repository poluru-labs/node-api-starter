import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { discoverPapers } from './literature.ts';
import type { Paper } from './literature.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 1_000;

export interface PaperStore {
  save(paper: Paper): Paper;
  get(id: string): Paper | undefined;
  list(): readonly Paper[];
}

export function createPaperStore(): PaperStore {
  const papers = new Map<string, Paper>();
  return {
    save(paper) {
      remember(papers, paper.id, paper, storeLimit);
      return paper;
    },
    get(id) {
      return papers.get(id);
    },
    list() {
      return [...papers.values()];
    },
  };
}

export function createRoutes(store: PaperStore = createPaperStore()): readonly Route[] {
  return [
    root('Literature discovery is running.'),
    {
      method: 'POST',
      path: '/v1/papers',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parsePaper(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'GET',
      path: '/v1/papers/:id',
      handler(ctx) {
        const paper = store.get(ctx.params['id'] ?? '');
        if (paper === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, paper);
      },
    },
    {
      method: 'POST',
      path: '/v1/discover',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseQuery(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          200,
          discoverPapers(store.list(), parsed.query, parsed.yearFrom, parsed.yearTo, parsed.limit),
        );
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-literature-discovery.json')),
  ];
}

function parsePaper(body: unknown): Omit<Paper, 'id'> | undefined {
  if (
    !isRecord(body) ||
    typeof body['title'] !== 'string' ||
    typeof body['abstract'] !== 'string'
  ) {
    return undefined;
  }
  const title = body['title'].trim();
  const abstract = body['abstract'].trim();
  if (title.length === 0 || title.length > 200 || abstract.length < 20 || abstract.length > 4_000) {
    return undefined;
  }
  const year = body['year'];
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1800 || year > 2100) {
    return undefined;
  }
  const authors = stringList(body['authors'], 1, 12, 80);
  const keywords = stringList(body['keywords'], 0, 12, 40);
  if (authors === undefined || keywords === undefined) {
    return undefined;
  }
  const doi = body['doi'] ?? null;
  if (
    doi !== null &&
    (typeof doi !== 'string' || !/^10\.\d{4,9}\/\S+$/.test(doi) || doi.length > 120)
  ) {
    return undefined;
  }
  return { title, authors, year, abstract, keywords, doi };
}

function parseQuery(
  body: unknown,
): { query: string; yearFrom: number | null; yearTo: number | null; limit: number } | undefined {
  if (
    !isRecord(body) ||
    typeof body['query'] !== 'string' ||
    body['query'].trim().length === 0 ||
    body['query'].length > 200
  ) {
    return undefined;
  }
  const yearFrom = optionalYear(body['yearFrom']);
  const yearTo = optionalYear(body['yearTo']);
  if (yearFrom === 'invalid' || yearTo === 'invalid') {
    return undefined;
  }
  const limit = body['limit'] === undefined ? 10 : body['limit'];
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    return undefined;
  }
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) {
    return undefined;
  }
  return { query: body['query'].trim(), yearFrom, yearTo, limit };
}

function optionalYear(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1800 || value > 2100) {
    return 'invalid';
  }
  return value;
}

function stringList(
  value: unknown,
  min: number,
  max: number,
  itemMax: number,
): string[] | undefined {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    return undefined;
  }
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0 || entry.trim().length > itemMax) {
      return undefined;
    }
    items.push(entry.trim());
  }
  return items;
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
