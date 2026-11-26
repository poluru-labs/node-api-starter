import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isJsonType, validateOutput } from './validate.ts';
import type { Contract, JsonType, ValidationReport } from './validate.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface ValidationStore {
  save(report: ValidationReport): ValidationReport;
  get(id: string): ValidationReport | undefined;
}

export function createValidationStore(): ValidationStore {
  const reports = new Map<string, ValidationReport>();
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

export function createRoutes(store: ValidationStore = createValidationStore()): readonly Route[] {
  return [
    root('Output validation is running.'),
    {
      method: 'POST',
      path: '/v1/validations',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        if (!isRecord(body) || !('output' in body)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const contract = parseContract(body['contract'], 0);
        if (contract === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(validateOutput(body['output'], contract, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/validations/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-output-validation.json')),
  ];
}

function parseContract(value: unknown, depth: number): Contract | undefined {
  if (!isRecord(value) || depth > 6 || !isJsonType(value['type'])) {
    return undefined;
  }
  const type = value['type'];
  const additionalProperties =
    value['additionalProperties'] === undefined ? true : value['additionalProperties'];
  if (typeof additionalProperties !== 'boolean') {
    return undefined;
  }
  const enumValues = parseEnum(value['enum'], type);
  const minimum = bound(value['minimum'], type === 'number');
  const maximum = bound(value['maximum'], type === 'number');
  const minLength = lengthBound(value['minLength'], type === 'string');
  const maxLength = lengthBound(value['maxLength'], type === 'string');
  if (
    enumValues === 'invalid' ||
    minimum === 'invalid' ||
    maximum === 'invalid' ||
    minLength === 'invalid' ||
    maxLength === 'invalid'
  ) {
    return undefined;
  }
  const properties: Record<string, Contract> = {};
  const required = parseRequired(value['required'], type);
  if (required === undefined) {
    return undefined;
  }
  if (value['properties'] !== undefined) {
    if (type !== 'object' || !isRecord(value['properties'])) {
      return undefined;
    }
    const entries = Object.entries(value['properties']);
    if (entries.length > 30) {
      return undefined;
    }
    for (const [key, child] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) {
        return undefined;
      }
      const parsed = parseContract(child, depth + 1);
      if (parsed === undefined) {
        return undefined;
      }
      properties[key] = parsed;
    }
  }
  if (required.some((key) => properties[key] === undefined)) {
    return undefined;
  }
  let items: Contract | null = null;
  if (value['items'] !== undefined) {
    if (type !== 'array') {
      return undefined;
    }
    const parsed = parseContract(value['items'], depth + 1);
    if (parsed === undefined) {
      return undefined;
    }
    items = parsed;
  }
  return {
    type,
    required,
    properties,
    additionalProperties,
    enumValues,
    minimum,
    maximum,
    minLength,
    maxLength,
    items,
  };
}

function parseEnum(
  value: unknown,
  type: JsonType,
): (string | number | boolean)[] | null | 'invalid' {
  if (value === undefined) {
    return null;
  }
  if (
    (type !== 'string' && type !== 'number' && type !== 'boolean') ||
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 20
  ) {
    return 'invalid';
  }
  const items: (string | number | boolean)[] = [];
  for (const entry of value) {
    if (typeof entry !== type) {
      return 'invalid';
    }
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      items.push(entry);
    }
  }
  return items;
}

function bound(value: unknown, allowed: boolean): number | null | 'invalid' {
  if (value === undefined) {
    return null;
  }
  if (!allowed || typeof value !== 'number' || !Number.isFinite(value)) {
    return 'invalid';
  }
  return value;
}

function lengthBound(value: unknown, allowed: boolean): number | null | 'invalid' {
  if (value === undefined) {
    return null;
  }
  if (
    !allowed ||
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10_000
  ) {
    return 'invalid';
  }
  return value;
}

function parseRequired(value: unknown, type: JsonType): string[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (type !== 'object' || !Array.isArray(value) || value.length > 30) {
    return undefined;
  }
  const required: string[] = [];
  for (const entry of value) {
    if (
      typeof entry !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(entry) ||
      required.includes(entry)
    ) {
      return undefined;
    }
    required.push(entry);
  }
  return required;
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
