import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { planWaste } from './waste.ts';
import type { WasteRecord, WasteReport } from './waste.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface WasteStore {
  save(report: WasteReport): WasteReport;
  get(id: string): WasteReport | undefined;
}

export function createWasteStore(): WasteStore {
  const reports = new Map<string, WasteReport>();
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

export function createRoutes(store: WasteStore = createWasteStore()): readonly Route[] {
  return [
    root('Food waste forecasting is running.'),
    {
      method: 'POST',
      path: '/v1/kitchens',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseKitchen(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(planWaste(parsed.name, parsed.records, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/kitchens/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-food-waste-forecasting.json')),
  ];
}

function parseKitchen(body: unknown): { name: string; records: WasteRecord[] } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || !Array.isArray(body['records'])) {
    return undefined;
  }
  const name = body['name'].trim();
  if (
    name.length === 0 ||
    name.length > 80 ||
    body['records'].length === 0 ||
    body['records'].length > 400
  ) {
    return undefined;
  }
  const records: WasteRecord[] = [];
  const seen = new Set<string>();
  for (const entry of body['records']) {
    const record = parseRecord(entry);
    if (record === undefined) {
      return undefined;
    }
    const key = `${record.day}:${record.item}`;
    if (seen.has(key)) {
      return undefined;
    }
    seen.add(key);
    records.push(record);
  }
  return { name, records };
}

function parseRecord(value: unknown): WasteRecord | undefined {
  if (!isRecord(value) || typeof value['day'] !== 'string' || typeof value['item'] !== 'string') {
    return undefined;
  }
  if (!isDay(value['day'])) {
    return undefined;
  }
  const item = value['item'].trim().toLowerCase();
  if (item.length === 0 || item.length > 40) {
    return undefined;
  }
  const prepared = amount(value['prepared']);
  const sold = amount(value['sold']);
  const wasted = amount(value['wasted']);
  if (prepared === undefined || sold === undefined || wasted === undefined) {
    return undefined;
  }
  return { day: value['day'], item, prepared, sold, wasted };
}

function amount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000) {
    return undefined;
  }
  return value;
}

function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
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
