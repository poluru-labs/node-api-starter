import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import {
  addRelation,
  isArtifactKind,
  isArtifactLicense,
  isRelationType,
  searchArtifacts,
} from './artifacts.ts';
import type { Artifact, ArtifactKind } from './artifacts.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface ArtifactStore {
  save(artifact: Artifact): Artifact;
  get(id: string): Artifact | undefined;
  list(): readonly Artifact[];
}

export function createArtifactStore(): ArtifactStore {
  const artifacts = new Map<string, Artifact>();
  return {
    save(artifact) {
      remember(artifacts, artifact.id, artifact, storeLimit);
      return artifact;
    },
    get(id) {
      return artifacts.get(id);
    },
    list() {
      return [...artifacts.values()];
    },
  };
}

export function createRoutes(store: ArtifactStore = createArtifactStore()): readonly Route[] {
  return [
    root('Research artifact index is running.'),
    {
      method: 'POST',
      path: '/v1/artifacts',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseArtifact(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed, relations: [] }));
      },
    },
    {
      method: 'POST',
      path: '/v1/artifacts/:id/relations',
      async handler(ctx) {
        const artifact = store.get(ctx.params['id'] ?? '');
        if (artifact === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (
          !isRecord(body) ||
          !isRelationType(body['type']) ||
          typeof body['targetId'] !== 'string'
        ) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (body['targetId'] === artifact.id) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (store.get(body['targetId']) === undefined) {
          ctx.sendJson(400, { error: 'unknown_target' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(addRelation(artifact, { type: body['type'], targetId: body['targetId'] })),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/artifacts/:id',
      handler(ctx) {
        const artifact = store.get(ctx.params['id'] ?? '');
        if (artifact === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, artifact);
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
        ctx.sendJson(200, {
          matches: searchArtifacts(store.list(), parsed.query, parsed.kind, parsed.limit),
        });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-research-artifact-index.json')),
  ];
}

function parseArtifact(body: unknown): Omit<Artifact, 'id' | 'relations'> | undefined {
  if (!isRecord(body) || !isArtifactKind(body['kind']) || !isArtifactLicense(body['license'])) {
    return undefined;
  }
  const title = text(body['title'], 200);
  const summary = text(body['summary'], 500);
  if (title === undefined || summary === undefined) {
    return undefined;
  }
  if (
    typeof body['version'] !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,30}$/.test(body['version'])
  ) {
    return undefined;
  }
  if (
    typeof body['identifier'] !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9:./_+-]{0,120}$/.test(body['identifier'])
  ) {
    return undefined;
  }
  return {
    kind: body['kind'],
    title,
    version: body['version'],
    license: body['license'],
    identifier: body['identifier'],
    summary,
  };
}

function parseSearch(
  body: unknown,
): { query: string; kind: ArtifactKind | null; limit: number } | undefined {
  if (
    !isRecord(body) ||
    typeof body['query'] !== 'string' ||
    body['query'].trim().length === 0 ||
    body['query'].length > 200
  ) {
    return undefined;
  }
  let kind: ArtifactKind | null = null;
  if (body['kind'] !== undefined && body['kind'] !== null) {
    if (!isArtifactKind(body['kind'])) {
      return undefined;
    }
    kind = body['kind'];
  }
  const limit = body['limit'] === undefined ? 10 : body['limit'];
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    return undefined;
  }
  return { query: body['query'].trim(), kind, limit };
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
