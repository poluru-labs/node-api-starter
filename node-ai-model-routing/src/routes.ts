import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { chooseModel, isModelTier } from './routing.ts';
import type { ModelCard, RouteRequest } from './routing.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 100;

export interface ModelStore {
  save(model: ModelCard): ModelCard;
  get(id: string): ModelCard | undefined;
  findByName(name: string): ModelCard | undefined;
  list(): readonly ModelCard[];
}

export function createModelStore(): ModelStore {
  const models = new Map<string, ModelCard>();
  return {
    save(model) {
      remember(models, model.id, model, storeLimit);
      return model;
    },
    get(id) {
      return models.get(id);
    },
    findByName(name) {
      return [...models.values()].find((model) => model.name === name);
    },
    list() {
      return [...models.values()];
    },
  };
}

export function createRoutes(store: ModelStore = createModelStore()): readonly Route[] {
  return [
    root('Model routing is running.'),
    {
      method: 'POST',
      path: '/v1/models',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseModel(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (store.findByName(parsed.name) !== undefined) {
          ctx.sendJson(409, { error: 'duplicate_model' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'GET',
      path: '/v1/models/:id',
      handler(ctx) {
        const model = store.get(ctx.params['id'] ?? '');
        if (model === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, model);
      },
    },
    {
      method: 'POST',
      path: '/v1/routes',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const request = parseRoute(body);
        if (request === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(200, chooseModel(store.list(), request));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-model-routing.json')),
  ];
}

function parseModel(body: unknown): Omit<ModelCard, 'id'> | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || !isModelTier(body['tier'])) {
    return undefined;
  }
  if (
    !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(body['name']) ||
    typeof body['allowsSensitive'] !== 'boolean'
  ) {
    return undefined;
  }
  const costPer1kTokens = numberIn(body['costPer1kTokens'], 0, 1_000);
  const maxLatencyMs = integerIn(body['maxLatencyMs'], 1, 120_000);
  const capabilities = stringList(body['capabilities']);
  if (costPer1kTokens === undefined || maxLatencyMs === undefined || capabilities === undefined) {
    return undefined;
  }
  return {
    name: body['name'],
    tier: body['tier'],
    costPer1kTokens,
    maxLatencyMs,
    capabilities: [...new Set(capabilities.map((item) => item.toLowerCase()))],
    allowsSensitive: body['allowsSensitive'],
  };
}

function parseRoute(body: unknown): RouteRequest | undefined {
  if (
    !isRecord(body) ||
    typeof body['task'] !== 'string' ||
    typeof body['sensitive'] !== 'boolean'
  ) {
    return undefined;
  }
  const task = body['task'].trim();
  const needs = stringList(body['needs']);
  if (task.length === 0 || task.length > 80 || needs === undefined) {
    return undefined;
  }
  const maxCostPer1k = optionalNumber(body['maxCostPer1k'], 0, 1_000);
  const maxLatencyMs = optionalInteger(body['maxLatencyMs'], 1, 120_000);
  if (maxCostPer1k === 'invalid' || maxLatencyMs === 'invalid') {
    return undefined;
  }
  return { task, needs, sensitive: body['sensitive'], maxCostPer1k, maxLatencyMs };
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
    return undefined;
  }
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/.test(entry)) {
      return undefined;
    }
    items.push(entry);
  }
  return items;
}

function optionalNumber(value: unknown, min: number, max: number): number | null | 'invalid' {
  if (value === undefined || value === null) {
    return null;
  }
  return numberIn(value, min, max) ?? 'invalid';
}

function optionalInteger(value: unknown, min: number, max: number): number | null | 'invalid' {
  if (value === undefined || value === null) {
    return null;
  }
  return integerIn(value, min, max) ?? 'invalid';
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return undefined;
  }
  return value;
}

function integerIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return undefined;
  }
  return value;
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
