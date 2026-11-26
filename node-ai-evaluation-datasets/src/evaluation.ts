export const evalTasks = ['classification', 'question-answering', 'extraction', 'ranking'] as const;
export type EvalTask = (typeof evalTasks)[number];

export const evalSplits = ['train', 'validation', 'test'] as const;
export type EvalSplit = (typeof evalSplits)[number];

export interface EvalItem {
  readonly id: string;
  readonly input: string;
  readonly expected: string;
  readonly split: EvalSplit | null;
}

export interface EvalFinding {
  readonly code:
    | 'duplicate_id'
    | 'empty_field'
    | 'duplicate_input'
    | 'leakage'
    | 'imbalance'
    | 'small_set'
    | 'missing_split';
  readonly message: string;
}

export interface EvalReport {
  readonly id: string;
  readonly name: string;
  readonly task: EvalTask;
  readonly itemCount: number;
  readonly ok: boolean;
  readonly recommendedSplit: {
    readonly train: number;
    readonly validation: number;
    readonly test: number;
  } | null;
  readonly findings: readonly EvalFinding[];
}

const blocking = new Set<EvalFinding['code']>([
  'duplicate_id',
  'empty_field',
  'duplicate_input',
  'leakage',
  'missing_split',
]);

export function isEvalTask(value: unknown): value is EvalTask {
  return typeof value === 'string' && evalTasks.some((task) => task === value);
}

export function isEvalSplit(value: unknown): value is EvalSplit {
  return typeof value === 'string' && evalSplits.some((split) => split === value);
}

export function reviewEvaluation(
  name: string,
  task: EvalTask,
  items: readonly EvalItem[],
  id: string,
): EvalReport {
  const findings: EvalFinding[] = [];
  const ids = new Map<string, number>();
  const inputs = new Map<string, EvalSplit | null>();
  const anySplit = items.some((item) => item.split !== null);

  for (const item of items) {
    ids.set(item.id, (ids.get(item.id) ?? 0) + 1);
    if (item.input.trim().length === 0 || item.expected.trim().length === 0) {
      findings.push({
        code: 'empty_field',
        message: `Item ${item.id} needs both input and expected output.`,
      });
    }
    const previous = inputs.get(item.input);
    if (previous === undefined) {
      inputs.set(item.input, item.split);
    } else {
      findings.push({
        code: 'duplicate_input',
        message: `Input for ${item.id} is repeated.`,
      });
      if (item.split !== null && previous !== null && item.split !== previous) {
        findings.push({
          code: 'leakage',
          message: `Input for ${item.id} appears in more than one split.`,
        });
      }
    }
    if (anySplit && item.split === null) {
      findings.push({
        code: 'missing_split',
        message: `Item ${item.id} has no split while other items do.`,
      });
    }
  }

  for (const [itemId, count] of ids) {
    if (count > 1) {
      findings.push({
        code: 'duplicate_id',
        message: `Id ${itemId} is used ${String(count)} times.`,
      });
    }
  }

  if (items.length < 20) {
    findings.push({
      code: 'small_set',
      message: 'Fewer than 20 items is a weak evaluation set.',
    });
  }

  if (task === 'classification') {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.expected, (counts.get(item.expected) ?? 0) + 1);
    }
    const smallest = Math.min(...counts.values());
    if (items.length >= 10 && counts.size > 1 && smallest / items.length < 0.1) {
      findings.push({
        code: 'imbalance',
        message: 'A class is under 10 percent of the rows.',
      });
    }
  }

  const unique: EvalFinding[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    if (!seen.has(finding.code + finding.message)) {
      seen.add(finding.code + finding.message);
      unique.push(finding);
    }
  }

  return {
    id,
    name,
    task,
    itemCount: items.length,
    ok: unique.every((finding) => !blocking.has(finding.code)),
    recommendedSplit: anySplit ? null : { train: 0.8, validation: 0.1, test: 0.1 },
    findings: unique,
  };
}
