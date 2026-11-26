import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { scoreRetrieval } from './metrics.ts';
import type { RankedQuery, RetrievalReport } from './metrics.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface RetrievalStore {
  save(report: RetrievalReport): RetrievalReport;
  get(id: string): RetrievalReport | undefined;
}

export function createRetrievalStore(): RetrievalStore {
  const reports = new Map<string, RetrievalReport>();
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

export function createRoutes(store: RetrievalStore = createRetrievalStore()): readonly Route[] {
  return [
    root('Retrieval benchmarks is running.'),
    {
      method: 'POST',
      path: '/v1/benchmarks',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseBenchmark(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(scoreRetrieval(parsed.name, parsed.k, parsed.queries, randomUUID())),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/benchmarks/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-retrieval-benchmarks.json')),
  ];
}

function parseBenchmark(
  body: unknown,
): { name: string; k: number; queries: RankedQuery[] } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || !Array.isArray(body['queries'])) {
    return undefined;
  }
  const name = body['name'].trim();
  const k = body['k'] === undefined ? 10 : body['k'];
  if (
    name.length === 0 ||
    name.length > 80 ||
    typeof k !== 'number' ||
    !Number.isInteger(k) ||
    k < 1 ||
    k > 20
  ) {
    return undefined;
  }
  if (body['queries'].length === 0 || body['queries'].length > 50) {
    return undefined;
  }
  const queries: RankedQuery[] = [];
  const seen = new Set<string>();
  for (const entry of body['queries']) {
    const query = parseQuery(entry);
    if (query === undefined || seen.has(query.id)) {
      return undefined;
    }
    seen.add(query.id);
    queries.push(query);
  }
  return { name, k, queries };
}

function parseQuery(value: unknown): RankedQuery | undefined {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(value['id'])
  ) {
    return undefined;
  }
  const relevant = idList(value['relevant'], 1, 50);
  const ranked = idList(value['ranked'], 1, 100);
  if (relevant === undefined || ranked === undefined) {
    return undefined;
  }
  return { id: value['id'], relevant, ranked };
}

function idList(value: unknown, min: number, max: number): string[] | undefined {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    return undefined;
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(entry)) {
      return undefined;
    }
    ids.push(entry);
  }
  return ids;
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
