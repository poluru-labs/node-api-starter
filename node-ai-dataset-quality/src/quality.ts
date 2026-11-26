export const fieldTypes = ['string', 'number', 'boolean'] as const;
export type FieldType = (typeof fieldTypes)[number];

export interface ColumnProfile {
  readonly name: string;
  readonly missing: number;
  readonly types: readonly string[];
  readonly unique: number;
  readonly outliers: number;
}

export interface SchemaViolation {
  readonly row: number;
  readonly field: string;
  readonly expected: FieldType;
  readonly actual: string;
}

export interface QualityReport {
  readonly id: string;
  readonly name: string;
  readonly rows: number;
  readonly duplicateRows: number;
  readonly columns: readonly ColumnProfile[];
  readonly schemaViolations: readonly SchemaViolation[];
  readonly score: number;
}

export function isFieldType(value: unknown): value is FieldType {
  return fieldTypes.some((kind) => kind === value);
}

export function profileDataset(
  name: string,
  rows: readonly Record<string, unknown>[],
  schema: Readonly<Record<string, FieldType>>,
  id: string,
): QualityReport {
  const names = new Set<string>(Object.keys(schema));
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      names.add(key);
    }
  }
  const columns = [...names].sort().map((column) => profileColumn(column, rows));
  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    const fingerprint = JSON.stringify(sortRow(row));
    if (seen.has(fingerprint)) {
      duplicateRows += 1;
    } else {
      seen.add(fingerprint);
    }
  }
  const schemaViolations: SchemaViolation[] = [];
  rows.forEach((row, index) => {
    for (const [field, expected] of Object.entries(schema)) {
      if (!Object.hasOwn(row, field) || isMissing(row[field])) {
        continue;
      }
      const actual = valueType(row[field]);
      if (actual !== expected) {
        schemaViolations.push({ row: index, field, expected, actual });
      }
    }
  });
  const missingCells = columns.reduce((total, column) => total + column.missing, 0);
  const penalty = duplicateRows * 10 + schemaViolations.length * 5 + missingCells * 2;
  return {
    id,
    name,
    rows: rows.length,
    duplicateRows,
    columns,
    schemaViolations,
    score: Math.max(0, 100 - penalty),
  };
}

function profileColumn(name: string, rows: readonly Record<string, unknown>[]): ColumnProfile {
  const present: unknown[] = [];
  let missing = 0;
  for (const row of rows) {
    const value = row[name];
    if (!Object.hasOwn(row, name) || isMissing(value)) {
      missing += 1;
    } else {
      present.push(value);
    }
  }
  const types = [...new Set(present.map((value) => valueType(value)))].sort();
  const unique = new Set(present.map((value) => JSON.stringify(value))).size;
  return { name, missing, types, unique, outliers: numericOutliers(present) };
}

function numericOutliers(values: readonly unknown[]): number {
  const numbers = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (numbers.length < 4) {
    return 0;
  }
  const sorted = [...numbers].sort((left, right) => left - right);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const span = (q3 - q1) * 1.5;
  return numbers.filter((value) => value < q1 - span || value > q3 + span).length;
}

function quantile(sorted: readonly number[], ratio: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

function sortRow(row: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(row).sort()) {
    sorted[key] = row[key];
  }
  return sorted;
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function valueType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}
