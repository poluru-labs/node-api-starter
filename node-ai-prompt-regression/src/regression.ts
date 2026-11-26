export interface PromptCase {
  readonly id: string;
  readonly prompt: string;
  readonly baseline: string;
}

export interface PromptSuite {
  readonly id: string;
  readonly name: string;
  readonly cases: readonly PromptCase[];
}

export interface CaseResult {
  readonly id: string;
  readonly status: 'match' | 'changed' | 'missing' | 'unexpected';
}

export interface RegressionRun {
  readonly id: string;
  readonly suiteId: string;
  readonly method: 'normalized-compare';
  readonly passRate: number;
  readonly ok: boolean;
  readonly results: readonly CaseResult[];
}

export function compareRun(
  suite: PromptSuite,
  outputs: readonly { readonly id: string; readonly output: string }[],
  id: string,
): RegressionRun {
  const byId = new Map(outputs.map((item) => [item.id, item.output]));
  const known = new Set(suite.cases.map((item) => item.id));
  const results: CaseResult[] = suite.cases.map((item) => {
    const output = byId.get(item.id);
    if (output === undefined) {
      return { id: item.id, status: 'missing' };
    }
    return { id: item.id, status: sameOutput(item.baseline, output) ? 'match' : 'changed' };
  });
  for (const output of outputs) {
    if (!known.has(output.id)) {
      results.push({ id: output.id, status: 'unexpected' });
    }
  }
  const matches = results.filter((result) => result.status === 'match').length;
  const passRate = suite.cases.length === 0 ? 0 : round4(matches / suite.cases.length);
  return {
    id,
    suiteId: suite.id,
    method: 'normalized-compare',
    passRate,
    ok: results.every((result) => result.status === 'match'),
    results,
  };
}

function sameOutput(baseline: string, output: string): boolean {
  const baseJson = parseStructured(baseline);
  const outputJson = parseStructured(output);
  if (baseJson !== undefined && outputJson !== undefined) {
    return stable(baseJson) === stable(outputJson);
  }
  return normalize(baseline) === normalize(output);
}

function parseStructured(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
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

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
