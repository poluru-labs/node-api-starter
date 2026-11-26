export const jsonTypes = ['string', 'number', 'boolean', 'object', 'array', 'null'] as const;
export type JsonType = (typeof jsonTypes)[number];

export interface Contract {
  readonly type: JsonType;
  readonly required: readonly string[];
  readonly properties: Readonly<Record<string, Contract>>;
  readonly additionalProperties: boolean;
  readonly enumValues: readonly (string | number | boolean)[] | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly items: Contract | null;
}

export interface Violation {
  readonly path: string;
  readonly code:
    | 'type_mismatch'
    | 'missing_property'
    | 'additional_property'
    | 'enum_mismatch'
    | 'range'
    | 'length'
    | 'too_deep';
  readonly message: string;
}

export interface ValidationReport {
  readonly id: string;
  readonly method: 'contract';
  readonly ok: boolean;
  readonly violations: readonly Violation[];
}

export function isJsonType(value: unknown): value is JsonType {
  return typeof value === 'string' && jsonTypes.some((type) => type === value);
}

export function validateOutput(value: unknown, contract: Contract, id: string): ValidationReport {
  const violations: Violation[] = [];
  check(value, contract, '$', 0, violations);
  violations.sort(
    (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
  return { id, method: 'contract', ok: violations.length === 0, violations };
}

function check(
  value: unknown,
  contract: Contract,
  path: string,
  depth: number,
  violations: Violation[],
): void {
  if (depth > 8) {
    violations.push({ path, code: 'too_deep', message: 'The value is nested more than 8 levels.' });
    return;
  }
  const actual = jsonType(value);
  if (actual !== contract.type) {
    violations.push({
      path,
      code: 'type_mismatch',
      message: `${path} should be ${contract.type}.`,
    });
    return;
  }
  if (contract.enumValues !== null && !contract.enumValues.some((item) => item === value)) {
    violations.push({
      path,
      code: 'enum_mismatch',
      message: `${path} is outside the allowed values.`,
    });
  }
  if (typeof value === 'number') {
    if (
      (contract.minimum !== null && value < contract.minimum) ||
      (contract.maximum !== null && value > contract.maximum)
    ) {
      violations.push({ path, code: 'range', message: `${path} is outside the allowed range.` });
    }
  }
  if (typeof value === 'string') {
    if (
      (contract.minLength !== null && value.length < contract.minLength) ||
      (contract.maxLength !== null && value.length > contract.maxLength)
    ) {
      violations.push({
        path,
        code: 'length',
        message: `${path} has a length outside the contract.`,
      });
    }
  }
  if (isRecord(value)) {
    for (const key of contract.required) {
      if (!Object.hasOwn(value, key)) {
        violations.push({
          path: `${path}.${key}`,
          code: 'missing_property',
          message: `${path}.${key} is required.`,
        });
      }
    }
    for (const key of Object.keys(value)) {
      const child = contract.properties[key];
      if (child === undefined) {
        if (!contract.additionalProperties) {
          violations.push({
            path: `${path}.${key}`,
            code: 'additional_property',
            message: `${path}.${key} is not in the contract.`,
          });
        }
        continue;
      }
      check(value[key], child, `${path}.${key}`, depth + 1, violations);
    }
  }
  if (Array.isArray(value) && contract.items !== null) {
    const items = contract.items;
    value.slice(0, 50).forEach((item, index) => {
      check(item, items, `${path}[${String(index)}]`, depth + 1, violations);
    });
    if (value.length > 50) {
      violations.push({ path, code: 'length', message: `${path} has more than 50 items.` });
    }
  }
}

function jsonType(value: unknown): JsonType {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  return 'null';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
