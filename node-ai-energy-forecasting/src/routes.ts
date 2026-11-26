import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { describeSeries, forecastSeries, isEnergyUnit } from './forecast.ts';
import type { EnergyPoint, EnergySeries } from './forecast.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface EnergyStore {
  save(series: EnergySeries): EnergySeries;
  get(id: string): EnergySeries | undefined;
}

export function createEnergyStore(): EnergyStore {
  const series = new Map<string, EnergySeries>();
  return {
    save(item) {
      remember(series, item.id, item, storeLimit);
      return item;
    },
    get(id) {
      return series.get(id);
    },
  };
}

export function createRoutes(store: EnergyStore = createEnergyStore()): readonly Route[] {
  return [
    root('Energy forecasting is running.'),
    {
      method: 'POST',
      path: '/v1/series',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseSeries(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const saved = store.save(
          describeSeries(parsed.name, parsed.unit, parsed.points, randomUUID()),
        );
        ctx.sendJson(201, {
          id: saved.id,
          name: saved.name,
          unit: saved.unit,
          count: saved.points.length,
          anomalies: saved.anomalies,
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/series/:id/forecast',
      async handler(ctx) {
        const series = store.get(ctx.params['id'] ?? '');
        if (series === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const horizon = parseHorizon(body);
        if (horizon === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (series.points.length < 3) {
          ctx.sendJson(400, { error: 'insufficient_history' });
          return;
        }
        ctx.sendJson(200, forecastSeries(series, horizon));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-energy-forecasting.json')),
  ];
}

function parseSeries(
  body: unknown,
): { name: string; unit: EnergySeries['unit']; points: EnergyPoint[] } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || !isEnergyUnit(body['unit'])) {
    return undefined;
  }
  const name = body['name'].trim();
  if (name.length === 0 || name.length > 80 || !Array.isArray(body['points'])) {
    return undefined;
  }
  if (body['points'].length < 3 || body['points'].length > 400) {
    return undefined;
  }
  const points: EnergyPoint[] = [];
  const seen = new Set<string>();
  for (const entry of body['points']) {
    const point = parsePoint(entry);
    if (point === undefined || seen.has(point.at)) {
      return undefined;
    }
    seen.add(point.at);
    points.push(point);
  }
  return { name, unit: body['unit'], points };
}

function parsePoint(value: unknown): EnergyPoint | undefined {
  if (!isRecord(value) || typeof value['at'] !== 'string') {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value['at'])) {
    return undefined;
  }
  const time = Date.parse(`${value['at']}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value['at']) {
    return undefined;
  }
  if (
    typeof value['value'] !== 'number' ||
    !Number.isFinite(value['value']) ||
    value['value'] < 0 ||
    value['value'] > 1e12
  ) {
    return undefined;
  }
  return { at: value['at'], value: value['value'] };
}

function parseHorizon(body: unknown): number | undefined {
  if (!isRecord(body) || typeof body['horizon'] !== 'number') {
    return undefined;
  }
  if (!Number.isInteger(body['horizon']) || body['horizon'] < 1 || body['horizon'] > 28) {
    return undefined;
  }
  return body['horizon'];
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
