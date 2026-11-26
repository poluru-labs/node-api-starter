import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createsCycle, isDigest, sha256, upstream } from './lineage.ts';
import type { ProvenanceNode } from './lineage.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

export interface ProvenanceStore {
  save(node: ProvenanceNode): ProvenanceNode;
  get(id: string): ProvenanceNode | undefined;
  nodes(): ReadonlyMap<string, ProvenanceNode>;
}

export function createProvenanceStore(): ProvenanceStore {
  const nodes = new Map<string, ProvenanceNode>();
  return {
    save(node) {
      nodes.set(node.id, node);
      return node;
    },
    get(id) {
      return nodes.get(id);
    },
    nodes() {
      return nodes;
    },
  };
}

export function createRoutes(store: ProvenanceStore = createProvenanceStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Data provenance is running.',
        });
      },
    },
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
        const created = parseArtifact(body);
        if (created === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (created === 'digest_mismatch') {
          ctx.sendJson(400, { error: 'digest_mismatch' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...created, inputs: [] }));
      },
    },
    {
      method: 'POST',
      path: '/v1/derivations',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined || !isRecord(body)) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        const output = store.get(typeof body['outputId'] === 'string' ? body['outputId'] : '');
        const inputIds = stringIds(body['inputIds']);
        const operation = body['operation'];
        if (
          output === undefined ||
          inputIds === undefined ||
          inputIds.length === 0 ||
          typeof operation !== 'string' ||
          operation.trim().length === 0 ||
          operation.trim().length > 80
        ) {
          ctx.sendJson(output === undefined ? 404 : 400, {
            error: output === undefined ? 'not_found' : 'invalid_body',
          });
          return;
        }
        if (inputIds.some((id) => store.get(id) === undefined)) {
          ctx.sendJson(400, { error: 'unknown_input' });
          return;
        }
        if (createsCycle(store.nodes(), output.id, inputIds)) {
          ctx.sendJson(409, { error: 'cycle' });
          return;
        }
        const inputs = [
          ...output.inputs,
          ...inputIds
            .filter((id) => !output.inputs.some((input) => input.id === id))
            .map((id) => ({ id, operation: operation.trim() })),
        ];
        ctx.sendJson(201, store.save({ ...output, inputs }));
      },
    },
    {
      method: 'GET',
      path: '/v1/artifacts/:id/lineage',
      handler(ctx) {
        const node = store.get(ctx.params['id'] ?? '');
        if (node === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, { artifact: node, lineage: upstream(store.nodes(), node.id) });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-data-provenance.json')),
  ];
}

function parseArtifact(
  body: unknown,
): { name: string; digest: string } | 'digest_mismatch' | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || body['name'].trim().length === 0) {
    return undefined;
  }
  if (body['name'].trim().length > 120) {
    return undefined;
  }
  const content = body['content'];
  const digest = body['digest'];
  if (typeof content === 'string') {
    if (content.length > 100_000) {
      return undefined;
    }
    const computed = sha256(content);
    if (digest !== undefined && digest !== computed) {
      return 'digest_mismatch';
    }
    return { name: body['name'].trim(), digest: computed };
  }
  if (isDigest(digest)) {
    return { name: body['name'].trim(), digest };
  }
  return undefined;
}

function stringIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > 20) {
    return undefined;
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 80) {
      return undefined;
    }
    ids.push(item);
  }
  return [...new Set(ids)];
}
