import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isServiceChannel, searchServices } from './catalog.ts';
import type { PublicService } from './catalog.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 1_000;

export interface CatalogStore {
  save(service: PublicService): PublicService;
  get(id: string): PublicService | undefined;
  list(): readonly PublicService[];
}

export function createCatalogStore(): CatalogStore {
  const services = new Map<string, PublicService>();
  return {
    save(service) {
      remember(services, service.id, service, storeLimit);
      return service;
    },
    get(id) {
      return services.get(id);
    },
    list() {
      return [...services.values()];
    },
  };
}

export function createRoutes(store: CatalogStore = createCatalogStore()): readonly Route[] {
  return [
    root('Public service search is running.'),
    {
      method: 'POST',
      path: '/v1/services',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseService(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'GET',
      path: '/v1/services/:id',
      handler(ctx) {
        const service = store.get(ctx.params['id'] ?? '');
        if (service === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, service);
      },
    },
    {
      method: 'POST',
      path: '/v1/search',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseSearch(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          200,
          searchServices(store.list(), parsed.query, parsed.area, parsed.category, parsed.limit),
        );
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-public-service-search.json')),
  ];
}

function parseService(body: unknown): Omit<PublicService, 'id'> | undefined {
  if (!isRecord(body) || !isServiceChannel(body['channel'])) {
    return undefined;
  }
  const name = text(body['name'], 120);
  const agency = text(body['agency'], 120);
  const category = text(body['category'], 40);
  if (name === undefined || agency === undefined || category === undefined) {
    return undefined;
  }
  const area = optionalText(body['area'], 40);
  const eligibility = stringList(body['eligibility']);
  if (!area.ok || eligibility === undefined) {
    return undefined;
  }
  return {
    name,
    agency,
    category: category.toLowerCase(),
    area: area.value === null ? null : area.value.toLowerCase(),
    eligibility,
    channel: body['channel'],
  };
}

function parseSearch(
  body: unknown,
): { query: string; area: string | null; category: string | null; limit: number } | undefined {
  if (
    !isRecord(body) ||
    typeof body['query'] !== 'string' ||
    body['query'].trim().length === 0 ||
    body['query'].length > 200
  ) {
    return undefined;
  }
  const area = optionalText(body['area'], 40);
  const category = optionalText(body['category'], 40);
  if (!area.ok || !category.ok) {
    return undefined;
  }
  const limit = body['limit'] === undefined ? 10 : body['limit'];
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    return undefined;
  }
  return {
    query: body['query'].trim(),
    area: area.value === null ? null : area.value.toLowerCase(),
    category: category.value === null ? null : category.value.toLowerCase(),
    limit,
  };
}

function optionalText(
  value: unknown,
  max: number,
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    return { ok: false };
  }
  return { ok: true, value: value.trim() };
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    return undefined;
  }
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0 || entry.trim().length > 40) {
      return undefined;
    }
    items.push(entry.trim().toLowerCase());
  }
  return items;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    return undefined;
  }
  return trimmed;
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
