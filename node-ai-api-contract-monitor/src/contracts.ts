export const jsonTypes = ['string', 'number', 'boolean', 'object', 'array'] as const;
export type JsonType = (typeof jsonTypes)[number];

export interface ContractExpect {
  readonly status: number;
  readonly required: readonly string[];
  readonly types: Readonly<Record<string, JsonType>>;
  readonly maxLatencyMs: number;
}

export interface Violation {
  readonly code: 'status_mismatch' | 'missing_field' | 'type_mismatch' | 'latency_budget';
  readonly path: string;
  readonly message: string;
}

export interface Observation {
  readonly id: string;
  readonly passed: boolean;
  readonly observedAt: string;
  readonly status: number;
  readonly latencyMs: number;
  readonly violations: readonly Violation[];
}

export interface Contract {
  readonly id: string;
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly expect: ContractExpect;
  readonly observations: readonly Observation[];
}

export interface ContractReport {
  readonly id: string;
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly checks: number;
  readonly passes: number;
  readonly passRate: number;
  readonly latest: Observation | null;
}

export function isJsonType(value: unknown): value is JsonType {
  return jsonTypes.some((kind) => kind === value);
}

export function evaluateObservation(
  expect: ContractExpect,
  input: { readonly status: number; readonly latencyMs: number; readonly body: unknown },
  id: string,
  observedAt: string,
): Observation {
  const violations: Violation[] = [];
  if (input.status !== expect.status) {
    violations.push({
      code: 'status_mismatch',
      path: 'status',
      message: `Expected status ${String(expect.status)} but received ${String(input.status)}.`,
    });
  }
  if (input.latencyMs > expect.maxLatencyMs) {
    violations.push({
      code: 'latency_budget',
      path: 'latencyMs',
      message: `Latency ${String(input.latencyMs)}ms exceeded ${String(expect.maxLatencyMs)}ms.`,
    });
  }
  for (const field of expect.required) {
    if (!hasField(input.body, field)) {
      violations.push({
        code: 'missing_field',
        path: field,
        message: `Required field ${field} is missing.`,
      });
    }
  }
  for (const [field, kind] of Object.entries(expect.types)) {
    if (!hasField(input.body, field)) {
      continue;
    }
    const actual = fieldValue(input.body, field);
    if (jsonTypeOf(actual) !== kind) {
      violations.push({
        code: 'type_mismatch',
        path: field,
        message: `Field ${field} must be ${kind}.`,
      });
    }
  }
  return {
    id,
    passed: violations.length === 0,
    observedAt,
    status: input.status,
    latencyMs: input.latencyMs,
    violations,
  };
}

export function report(contract: Contract): ContractReport {
  const passes = contract.observations.filter((item) => item.passed).length;
  const checks = contract.observations.length;
  return {
    id: contract.id,
    name: contract.name,
    method: contract.method,
    path: contract.path,
    checks,
    passes,
    passRate: checks === 0 ? 0 : Math.round((passes / checks) * 10_000) / 10_000,
    latest: contract.observations.at(-1) ?? null,
  };
}

function hasField(body: unknown, field: string): boolean {
  return fieldValue(body, field) !== undefined;
}

function fieldValue(body: unknown, field: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  if (!Object.hasOwn(record, field)) {
    return undefined;
  }
  return record[field];
}

function jsonTypeOf(value: unknown): JsonType | 'null' {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value === '' ? 'string' : (typeof value as JsonType);
  }
  if (typeof value === 'object') {
    return 'object';
  }
  return 'null';
}
