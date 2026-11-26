import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { decidePermission, isRiskLevel } from './permissions.ts';
import type { RiskLevel, ToolDefinition } from './permissions.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface PermissionStore {
  save(tool: ToolDefinition): ToolDefinition;
  get(id: string): ToolDefinition | undefined;
  findByName(name: string): ToolDefinition | undefined;
}

export function createPermissionStore(): PermissionStore {
  const tools = new Map<string, ToolDefinition>();
  const order: string[] = [];
  return {
    save(tool) {
      remember(tools, order, tool.id, tool, storeLimit);
      return tool;
    },
    get(id) {
      return tools.get(id);
    },
    findByName(name) {
      return [...tools.values()].find((tool) => tool.name === name);
    },
  };
}

export function createRoutes(store: PermissionStore = createPermissionStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, { service: 'tool-permissions' });
      },
    },
    {
      method: 'POST',
      path: '/v1/tools',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseTool(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        if (store.findByName(parsed.name) !== undefined) {
          ctx.sendJson(409, { error: 'duplicate_tool' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
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
        ctx.sendJson(
          200,
          decidePermission(
            store.findByName(parsed.tool),
            parsed.tool,
            parsed.scopes,
            parsed.maxRisk,
          ),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/tools/:id',
      handler(ctx) {
        const tool = store.get(ctx.params['id'] ?? '');
        if (tool === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, tool);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-tool-permissions.json')),
  ];
}

function parseTool(body: unknown): Pick<ToolDefinition, 'name' | 'risk' | 'scopes'> | undefined {
  if (
    !isRecord(body) ||
    typeof body['name'] !== 'string' ||
    !isRiskLevel(body['risk']) ||
    !Array.isArray(body['scopes'])
  ) {
    return undefined;
  }
  if (
    !/^[a-z][a-z0-9-]{0,63}$/.test(body['name']) ||
    body['scopes'].length < 1 ||
    body['scopes'].length > 12
  ) {
    return undefined;
  }
  const scopes = parseScopes(body['scopes']);
  if (scopes === undefined) {
    return undefined;
  }
  return { name: body['name'], risk: body['risk'], scopes };
}

function parseCheck(
  body: unknown,
): { tool: string; scopes: string[]; maxRisk: RiskLevel } | undefined {
  if (
    !isRecord(body) ||
    typeof body['tool'] !== 'string' ||
    !isRiskLevel(body['maxRisk']) ||
    !Array.isArray(body['scopes'])
  ) {
    return undefined;
  }
  if (
    !/^[a-z][a-z0-9-]{0,63}$/.test(body['tool']) ||
    body['scopes'].length < 1 ||
    body['scopes'].length > 12
  ) {
    return undefined;
  }
  const scopes = parseScopes(body['scopes']);
  if (scopes === undefined) {
    return undefined;
  }
  return { tool: body['tool'], scopes, maxRisk: body['maxRisk'] };
}

function parseScopes(value: unknown[]): string[] | undefined {
  const scopes: string[] = [];
  for (const scope of value) {
    if (
      typeof scope !== 'string' ||
      !/^[a-z][a-z0-9.:_-]{0,63}$/.test(scope) ||
      scopes.includes(scope)
    ) {
      return undefined;
    }
    scopes.push(scope);
  }
  return scopes;
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
