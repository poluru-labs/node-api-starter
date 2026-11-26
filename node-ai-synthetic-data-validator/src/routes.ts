import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isFieldType, validateSynthetic } from './synthetic.ts';
import type { FieldContract, SyntheticReport } from './synthetic.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface SyntheticStore {
  save(report: SyntheticReport): SyntheticReport;
  get(id: string): SyntheticReport | undefined;
}

export function createSyntheticStore(): SyntheticStore {
  const reports = new Map<string, SyntheticReport>();
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

export function createRoutes(store: SyntheticStore = createSyntheticStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'synthetic-data-validator' });
      },
    },
    {
      method: 'POST',
      path: '/v1/checks',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseCheck(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(validateSynthetic(parsed.fields, parsed.rows, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/checks/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-synthetic-data-validator.json')),
  ];
}

function parseCheck(
  body: unknown,
): { fields: FieldContract[]; rows: Record<string, unknown>[] } | undefined {
  if (!isRecord(body) || !Array.isArray(body['fields']) || !Array.isArray(body['rows'])) {
    return undefined;
  }
  if (
    body['fields'].length < 1 ||
    body['fields'].length > 20 ||
    body['rows'].length < 1 ||
    body['rows'].length > 200
  ) {
    return undefined;
  }
  const fields: FieldContract[] = [];
  for (const entry of body['fields']) {
    const field = parseField(entry);
    if (field === undefined || fields.some((item) => item.name === field.name)) {
      return undefined;
    }
    fields.push(field);
  }
  const rows: Record<string, unknown>[] = [];
  for (const row of body['rows']) {
    if (!isRecord(row)) {
      return undefined;
    }
    rows.push(row);
  }
  return { fields, rows };
}

function parseField(value: unknown): FieldContract | undefined {
  if (!isRecord(value) || typeof value['name'] !== 'string' || !isFieldType(value['type'])) {
    return undefined;
  }
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(value['name'])) {
    return undefined;
  }
  const minimum = optionalNumber(value['minimum']);
  const maximum = optionalNumber(value['maximum']);
  const categories = optionalCategories(value['categories']);
  if (!minimum.ok || !maximum.ok || !categories.ok) {
    return undefined;
  }
  if (minimum.value !== null && maximum.value !== null && minimum.value > maximum.value) {
    return undefined;
  }
  return {
    name: value['name'],
    type: value['type'],
    minimum: minimum.value,
    maximum: maximum.value,
    categories: categories.value,
  };
}

function optionalNumber(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false };
  }
  return { ok: true, value };
}

function optionalCategories(value: unknown): { ok: true; value: string[] | null } | { ok: false } {
  if (value === undefined) {
    return { ok: true, value: null };
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return { ok: false };
  }
  const categories: string[] = [];
  for (const entry of value) {
    if (
      typeof entry !== 'string' ||
      entry.length < 1 ||
      entry.length > 40 ||
      categories.includes(entry)
    ) {
      return { ok: false };
    }
    categories.push(entry);
  }
  return { ok: true, value: categories };
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
