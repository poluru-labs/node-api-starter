import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { inspectReadings, isWaterMetric } from './monitor.ts';
import type { WaterMonitor, WaterPoint } from './monitor.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface MonitorStore {
  save(monitor: WaterMonitor): WaterMonitor;
  get(id: string): WaterMonitor | undefined;
}

export function createMonitorStore(): MonitorStore {
  const monitors = new Map<string, WaterMonitor>();
  const order: string[] = [];
  return {
    save(monitor) {
      remember(monitors, order, monitor.id, monitor, storeLimit);
      return monitor;
    },
    get(id) {
      return monitors.get(id);
    },
  };
}

export function createRoutes(store: MonitorStore = createMonitorStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'water-anomaly-monitor' });
      },
    },
    {
      method: 'POST',
      path: '/v1/monitors',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseMonitor(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'POST',
      path: '/v1/monitors/:id/readings',
      async handler(ctx) {
        const monitor = store.get(ctx.params['id'] ?? '');
        if (monitor === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const points = parsePoints(body);
        if (points === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(200, inspectReadings(monitor, points));
      },
    },
    {
      method: 'GET',
      path: '/v1/monitors/:id',
      handler(ctx) {
        const monitor = store.get(ctx.params['id'] ?? '');
        if (monitor === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, monitor);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-water-anomaly-monitor.json')),
  ];
}

function parseMonitor(
  body: unknown,
): Pick<WaterMonitor, 'name' | 'metric' | 'unit' | 'threshold'> | undefined {
  if (
    !isRecord(body) ||
    typeof body['name'] !== 'string' ||
    !isWaterMetric(body['metric']) ||
    typeof body['unit'] !== 'string'
  ) {
    return undefined;
  }
  const name = body['name'].trim();
  const unit = body['unit'].trim();
  if (name.length < 1 || name.length > 80 || unit.length < 1 || unit.length > 16) {
    return undefined;
  }
  const threshold = body['threshold'];
  if (threshold === undefined) {
    return {
      name,
      metric: body['metric'],
      unit,
      threshold: body['metric'] === 'turbidity' ? 5 : null,
    };
  }
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
    return undefined;
  }
  return { name, metric: body['metric'], unit, threshold };
}

function parsePoints(body: unknown): WaterPoint[] | undefined {
  if (
    !isRecord(body) ||
    !Array.isArray(body['points']) ||
    body['points'].length < 1 ||
    body['points'].length > 400
  ) {
    return undefined;
  }
  const points: WaterPoint[] = [];
  for (const entry of body['points']) {
    if (!isRecord(entry) || typeof entry['at'] !== 'string' || typeof entry['value'] !== 'number') {
      return undefined;
    }
    if (!Number.isFinite(entry['value']) || Number.isNaN(Date.parse(entry['at']))) {
      return undefined;
    }
    if (points.some((point) => point.at === entry['at'])) {
      return undefined;
    }
    points.push({ at: entry['at'], value: entry['value'] });
  }
  return points;
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
