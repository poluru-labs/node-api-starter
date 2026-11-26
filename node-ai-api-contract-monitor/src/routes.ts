import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { evaluateObservation, isJsonType, report } from './contracts.ts';
import type { Contract, ContractExpect, JsonType } from './contracts.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;
const historyLimit = 100;

export interface ContractStore {
  save(contract: Contract): Contract;
  get(id: string): Contract | undefined;
}

export function createContractStore(): ContractStore {
  const contracts = new Map<string, Contract>();
  return {
    save(contract) {
      if (contracts.size >= storeLimit && !contracts.has(contract.id)) {
        const oldest = contracts.keys().next().value;
        if (oldest !== undefined) {
          contracts.delete(oldest);
        }
      }
      contracts.set(contract.id, contract);
      return contract;
    },
    get(id) {
      return contracts.get(id);
    },
  };
}

export function createRoutes(store: ContractStore = createContractStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'API contract monitor is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/contracts',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseContract(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const contract = store.save({ id: randomUUID(), ...parsed, observations: [] });
        ctx.sendJson(201, { ...report(contract), expect: contract.expect });
      },
    },
    {
      method: 'POST',
      path: '/v1/contracts/:id/observations',
      async handler(ctx) {
        const current = store.get(ctx.params['id'] ?? '');
        if (current === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const observed = parseObservation(body);
        if (observed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const observation = evaluateObservation(
          current.expect,
          observed,
          randomUUID(),
          new Date().toISOString(),
        );
        const observations = [...current.observations, observation].slice(-historyLimit);
        const contract = store.save({ ...current, observations });
        ctx.sendJson(201, { observation, report: report(contract) });
      },
    },
    {
      method: 'GET',
      path: '/v1/contracts/:id',
      handler(ctx) {
        const contract = store.get(ctx.params['id'] ?? '');
        if (contract === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, {
          ...report(contract),
          expect: contract.expect,
          observations: contract.observations,
        });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-api-contract-monitor.json')),
  ];
}

function parseContract(
  body: unknown,
): { name: string; method: string; path: string; expect: ContractExpect } | undefined {
  if (
    !isRecord(body) ||
    !isShortText(body['name']) ||
    !isShortText(body['method']) ||
    !isPath(body['path'])
  ) {
    return undefined;
  }
  if (!isRecord(body['expect']) || !isStatus(body['expect']['status'])) {
    return undefined;
  }
  const required = parseRequired(body['expect']['required']);
  const types = parseTypes(body['expect']['types']);
  if (required === undefined || types === undefined) {
    return undefined;
  }
  const maxLatencyMs =
    body['expect']['maxLatencyMs'] === undefined ? 500 : body['expect']['maxLatencyMs'];
  if (!isStatus(maxLatencyMs) || maxLatencyMs > 60_000) {
    return undefined;
  }
  return {
    name: body['name'].trim(),
    method: body['method'].trim().toUpperCase(),
    path: body['path'].trim(),
    expect: { status: body['expect']['status'], required, types, maxLatencyMs },
  };
}

function parseObservation(
  body: unknown,
): { status: number; latencyMs: number; body: unknown } | undefined {
  if (!isRecord(body) || !isStatus(body['status']) || !isStatus(body['latencyMs'])) {
    return undefined;
  }
  if (!('body' in body)) {
    return undefined;
  }
  return { status: body['status'], latencyMs: body['latencyMs'], body: body['body'] };
}

function parseRequired(value: unknown): string[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const fields: string[] = [];
  for (const item of value) {
    if (!isFieldName(item)) {
      return undefined;
    }
    fields.push(item);
  }
  return fields;
}

function parseTypes(value: unknown): Record<string, JsonType> | undefined {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const types: Record<string, JsonType> = {};
  for (const [key, kind] of Object.entries(value)) {
    if (!isFieldName(key) || !isJsonType(kind)) {
      return undefined;
    }
    types[key] = kind;
  }
  return types;
}

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
}

function isPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && value.length <= 200;
}

function isFieldName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
}

function isStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65_535;
}
