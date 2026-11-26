export interface ReplayStep {
  readonly name: string;
  readonly input: unknown;
  readonly output: unknown;
}

export interface ReplayDiff {
  readonly index: number;
  readonly field: 'count' | 'name' | 'input' | 'output';
  readonly expected: unknown;
  readonly actual: unknown;
}

export interface ReplayComparison {
  readonly matched: boolean;
  readonly diffs: readonly ReplayDiff[];
}

export function compareSteps(
  expected: readonly ReplayStep[],
  actual: readonly ReplayStep[],
): ReplayComparison {
  const diffs: ReplayDiff[] = [];
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const left = expected[index];
    const right = actual[index];
    if (left === undefined || right === undefined) {
      diffs.push({
        index,
        field: 'count',
        expected: left ?? null,
        actual: right ?? null,
      });
      continue;
    }
    if (left.name !== right.name) {
      diffs.push({ index, field: 'name', expected: left.name, actual: right.name });
    }
    if (stable(left.input) !== stable(right.input)) {
      diffs.push({ index, field: 'input', expected: left.input, actual: right.input });
    }
    if (stable(left.output) !== stable(right.output)) {
      diffs.push({ index, field: 'output', expected: left.output, actual: right.output });
    }
  }
  return { matched: diffs.length === 0, diffs };
}

export function parseSteps(value: unknown): ReplayStep[] | undefined {
  if (!Array.isArray(value) || value.length > 200) {
    return undefined;
  }
  const steps: ReplayStep[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return undefined;
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record['name'] !== 'string' ||
      record['name'].trim() === '' ||
      record['name'].length > 120
    ) {
      return undefined;
    }
    if (!('input' in record) || !('output' in record)) {
      return undefined;
    }
    steps.push({ name: record['name'].trim(), input: record['input'], output: record['output'] });
  }
  return steps;
}

function stable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}
