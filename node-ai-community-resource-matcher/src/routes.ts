import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { rankResources } from './match.ts';
import type { CommunityResource, MatchQuery } from './match.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 1_000;

export interface ResourceStore {
  save(resource: CommunityResource): CommunityResource;
  get(id: string): CommunityResource | undefined;
  list(): CommunityResource[];
}

export function createResourceStore(): ResourceStore {
  const resources = new Map<string, CommunityResource>();
  return {
    save(resource) {
      if (resources.size >= storeLimit && !resources.has(resource.id)) {
        const oldest = resources.keys().next().value;
        if (oldest !== undefined) {
          resources.delete(oldest);
        }
      }
      resources.set(resource.id, resource);
      return resource;
    },
    get(id) {
      return resources.get(id);
    },
    list() {
      return [...resources.values()];
    },
  };
}

export function createRoutes(store: ResourceStore = createResourceStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Community resource matcher is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/resources',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const resource = parseResource(body);
        if (resource === undefined) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(201, store.save({ ...resource, id: randomUUID() }));
      },
    },
    {
      method: 'GET',
      path: '/v1/resources/:id',
      handler(ctx) {
        const resource = store.get(ctx.params['id'] ?? '');
        if (resource === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, resource);
      },
    },
    {
      method: 'POST',
      path: '/v1/matches',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const query = parseQuery(body);
        if (query === undefined) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(200, { matches: rankResources(store.list(), query) });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-community-resource-matcher.json')),
  ];
}

function parseResource(body: unknown): Omit<CommunityResource, 'id'> | undefined {
  if (!isRecord(body) || !isName(body['name'])) {
    return undefined;
  }
  const needs = stringList(body['needs']);
  if (needs === undefined || needs.length === 0) {
    return undefined;
  }
  const region = optionalText(body['region']);
  const latitude = optionalCoordinate(body['latitude'], -90, 90);
  const longitude = optionalCoordinate(body['longitude'], -180, 180);
  if (!region.ok || !latitude.ok || !longitude.ok) {
    return undefined;
  }
  return {
    name: body['name'].trim(),
    needs,
    region: region.value,
    latitude: latitude.value,
    longitude: longitude.value,
  };
}

function parseQuery(body: unknown): MatchQuery | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const needs = stringList(body['needs']);
  if (needs === undefined || needs.length === 0) {
    return undefined;
  }
  const region = optionalText(body['region']);
  const latitude = optionalCoordinate(body['latitude'], -90, 90);
  const longitude = optionalCoordinate(body['longitude'], -180, 180);
  if (!region.ok || !latitude.ok || !longitude.ok) {
    return undefined;
  }
  const limit = body['limit'] === undefined ? 5 : body['limit'];
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    return undefined;
  }
  return {
    needs,
    region: region.value,
    latitude: latitude.value,
    longitude: longitude.value,
    limit,
  };
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > 20) {
    return undefined;
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0 || item.trim().length > 40) {
      return undefined;
    }
    items.push(item.trim());
  }
  return items;
}

function optionalText(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 40) {
    return { ok: false };
  }
  return { ok: true, value: value.trim().toLowerCase() };
}

function optionalCoordinate(
  value: unknown,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return { ok: false };
  }
  return { ok: true, value };
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
}
