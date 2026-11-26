export const evalTasks = ['classification', 'regression'] as const;
export type EvalTask = (typeof evalTasks)[number];

export interface ClassScore {
  readonly label: string;
  readonly support: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface ConfusionCell {
  readonly expected: string;
  readonly predicted: string;
  readonly count: number;
}

export interface ClassificationReport {
  readonly id: string;
  readonly task: 'classification';
  readonly method: 'classification-metrics';
  readonly count: number;
  readonly accuracy: number;
  readonly macroF1: number;
  readonly classes: readonly ClassScore[];
  readonly confusion: readonly ConfusionCell[];
}

export interface RegressionReport {
  readonly id: string;
  readonly task: 'regression';
  readonly method: 'regression-metrics';
  readonly count: number;
  readonly mae: number;
  readonly rmse: number;
  readonly bias: number;
}

export type ModelEvalReport = ClassificationReport | RegressionReport;

export function isEvalTask(value: unknown): value is EvalTask {
  return typeof value === 'string' && evalTasks.some((task) => task === value);
}

export function evaluateClassification(
  rows: readonly { expected: string; predicted: string }[],
  id: string,
): ClassificationReport {
  const labels = [...new Set(rows.map((row) => row.expected))].sort((left, right) =>
    left.localeCompare(right),
  );
  const matrix = new Map<string, number>();
  let correct = 0;
  for (const row of rows) {
    const key = `${row.expected}\u0000${row.predicted}`;
    matrix.set(key, (matrix.get(key) ?? 0) + 1);
    if (row.expected === row.predicted) {
      correct += 1;
    }
  }
  const classes = labels.map((label) => {
    let support = 0;
    let truePositive = 0;
    let falsePositive = 0;
    for (const row of rows) {
      if (row.expected === label) {
        support += 1;
        if (row.predicted === label) {
          truePositive += 1;
        }
      } else if (row.predicted === label) {
        falsePositive += 1;
      }
    }
    const precision =
      truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = support === 0 ? 0 : truePositive / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { label, support, precision, recall, f1 };
  });
  const macroF1 =
    classes.length === 0 ? 0 : classes.reduce((total, item) => total + item.f1, 0) / classes.length;
  const confusion = [...matrix.entries()]
    .map(([key, count]) => {
      const [expected, predicted] = key.split('\u0000');
      return { expected: expected ?? '', predicted: predicted ?? '', count };
    })
    .sort(
      (left, right) =>
        left.expected.localeCompare(right.expected) ||
        left.predicted.localeCompare(right.predicted),
    );
  return {
    id,
    task: 'classification',
    method: 'classification-metrics',
    count: rows.length,
    accuracy: round4(rows.length === 0 ? 0 : correct / rows.length),
    macroF1: round4(macroF1),
    classes: classes.map((item) => ({
      label: item.label,
      support: item.support,
      precision: round4(item.precision),
      recall: round4(item.recall),
      f1: round4(item.f1),
    })),
    confusion,
  };
}

export function evaluateRegression(
  rows: readonly { expected: number; predicted: number }[],
  id: string,
): RegressionReport {
  let absolute = 0;
  let squared = 0;
  let bias = 0;
  for (const row of rows) {
    const delta = row.predicted - row.expected;
    absolute += Math.abs(delta);
    squared += delta * delta;
    bias += delta;
  }
  const count = rows.length;
  return {
    id,
    task: 'regression',
    method: 'regression-metrics',
    count,
    mae: round4(count === 0 ? 0 : absolute / count),
    rmse: round4(count === 0 ? 0 : Math.sqrt(squared / count)),
    bias: round4(count === 0 ? 0 : bias / count),
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
