export const fieldTypes = ['string', 'number', 'boolean'] as const;
export type FieldType = (typeof fieldTypes)[number];

export interface FieldContract {
  readonly name: string;
  readonly type: FieldType;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly categories: readonly string[] | null;
}

export interface SyntheticFinding {
  readonly code:
    'type_mismatch' | 'out_of_range' | 'unknown_category' | 'sensitive_value' | 'duplicate_row';
  readonly row: number | null;
  readonly field: string | null;
  readonly message: string;
}

export interface SyntheticReport {
  readonly id: string;
  readonly method: 'constraint-check';
  readonly rowCount: number;
  readonly duplicateRows: number;
  readonly ok: boolean;
  readonly findings: readonly SyntheticFinding[];
}

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && fieldTypes.some((type) => type === value);
}

export function validateSynthetic(
  fields: readonly FieldContract[],
  rows: readonly Record<string, unknown>[],
  id: string,
): SyntheticReport {
  const findings: SyntheticFinding[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const fingerprint = stable(row);
    const previous = seen.get(fingerprint);
    if (previous !== undefined) {
      findings.push({
        code: 'duplicate_row',
        row: index,
        field: null,
        message: `Row ${String(index)} repeats row ${String(previous)}.`,
      });
    } else {
      seen.set(fingerprint, index);
    }
    for (const field of fields) {
      inspect(findings, field, row[field.name], index);
    }
  });
  const duplicates = findings.filter((finding) => finding.code === 'duplicate_row').length;
  return {
    id,
    method: 'constraint-check',
    rowCount: rows.length,
    duplicateRows: duplicates,
    ok: findings.length === 0,
    findings,
  };
}

function inspect(
  findings: SyntheticFinding[],
  field: FieldContract,
  value: unknown,
  row: number,
): void {
  if (value === undefined || value === null) {
    findings.push({
      code: 'type_mismatch',
      row,
      field: field.name,
      message: `${field.name} is missing.`,
    });
    return;
  }
  if (typeof value !== field.type) {
    findings.push({
      code: 'type_mismatch',
      row,
      field: field.name,
      message: `${field.name} should be ${field.type}.`,
    });
    return;
  }
  if (
    typeof value === 'number' &&
    ((field.minimum !== null && value < field.minimum) ||
      (field.maximum !== null && value > field.maximum))
  ) {
    findings.push({
      code: 'out_of_range',
      row,
      field: field.name,
      message: `${field.name} is outside the declared range.`,
    });
  }
  if (typeof value === 'string' && field.categories !== null && !field.categories.includes(value)) {
    findings.push({
      code: 'unknown_category',
      row,
      field: field.name,
      message: `${field.name} is outside the declared categories.`,
    });
  }
  if (typeof value === 'string' && looksSensitive(value)) {
    findings.push({
      code: 'sensitive_value',
      row,
      field: field.name,
      message: `${field.name} looks like a direct identifier.`,
    });
  }
}

function looksSensitive(value: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    return true;
  }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(value)) {
    return true;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 && luhn(digits);
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = digits.charCodeAt(index) - 48;
    if (alternate) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
