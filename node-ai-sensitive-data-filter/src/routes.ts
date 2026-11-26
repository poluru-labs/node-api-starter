import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { filterSensitive, isSensitiveKind, sensitiveKinds } from './filter.ts';
import type { FilterReport, SensitiveKind } from './filter.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;
const maxText = 20_000;

export interface FilterStore {
  save(report: FilterReport): FilterReport;
  get(id: string): FilterReport | undefined;
}

export function createFilterStore(): FilterStore {
  const reports = new Map<string, FilterReport>();
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

export function createRoutes(store: FilterStore = createFilterStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'sensitive-data-filter' });
      },
    },
    {
      method: 'POST',
      path: '/v1/filters',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseFilter(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(filterSensitive(parsed.text, parsed.kinds, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/filters/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-sensitive-data-filter.json')),
  ];
}

function parseFilter(body: unknown): { text: string; kinds: SensitiveKind[] } | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const text = body['text'];
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > maxText) {
    return undefined;
  }
  const kinds = body['kinds'];
  if (kinds === undefined) {
    return { text, kinds: [...sensitiveKinds] };
  }
  if (!Array.isArray(kinds) || kinds.length === 0 || kinds.length > sensitiveKinds.length) {
    return undefined;
  }
  const selected: SensitiveKind[] = [];
  for (const kind of kinds) {
    if (!isSensitiveKind(kind) || selected.includes(kind)) {
      return undefined;
    }
    selected.push(kind);
  }
  return { text, kinds: selected };
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
