export interface Judgment {
  readonly annotatorId: string;
  readonly label: string;
}

export interface ReviewTask {
  readonly id: string;
  readonly itemId: string;
  readonly allowedLabels: readonly string[];
  readonly judgments: readonly Judgment[];
}

export interface TaskAgreement {
  readonly taskId: string;
  readonly judgments: number;
  readonly unanimous: boolean;
  readonly majorityLabel: string | null;
  readonly pairwiseAgreement: number;
  readonly conflicts: readonly string[];
}

export interface CorpusAgreement {
  readonly tasks: number;
  readonly ratedTasks: number;
  readonly fleissKappa: number | null;
}

export function taskAgreement(task: ReviewTask): TaskAgreement {
  const counts = new Map<string, number>();
  for (const judgment of task.judgments) {
    counts.set(judgment.label, (counts.get(judgment.label) ?? 0) + 1);
  }
  let majorityLabel: string | null = null;
  let majorityCount = 0;
  let tied = false;
  for (const [label, count] of counts) {
    if (count > majorityCount) {
      majorityLabel = label;
      majorityCount = count;
      tied = false;
    } else if (count === majorityCount) {
      tied = true;
    }
  }
  if (tied || task.judgments.length === 0) {
    majorityLabel = null;
  }

  let matchingPairs = 0;
  let pairs = 0;
  const conflicts: string[] = [];
  for (let left = 0; left < task.judgments.length; left += 1) {
    for (let right = left + 1; right < task.judgments.length; right += 1) {
      const a = task.judgments[left];
      const b = task.judgments[right];
      if (a === undefined || b === undefined) {
        continue;
      }
      pairs += 1;
      if (a.label === b.label) {
        matchingPairs += 1;
      } else {
        conflicts.push(`${a.annotatorId}:${a.label}!=${b.annotatorId}:${b.label}`);
      }
    }
  }

  return {
    taskId: task.id,
    judgments: task.judgments.length,
    unanimous: task.judgments.length > 0 && conflicts.length === 0,
    majorityLabel,
    pairwiseAgreement: pairs === 0 ? 0 : round(matchingPairs / pairs),
    conflicts,
  };
}

export function corpusAgreement(tasks: readonly ReviewTask[]): CorpusAgreement {
  const rated = tasks.filter((task) => task.judgments.length >= 2);
  return {
    tasks: tasks.length,
    ratedTasks: rated.length,
    fleissKappa: fleissKappa(rated),
  };
}

export function fleissKappa(tasks: readonly ReviewTask[]): number | null {
  if (tasks.length === 0) {
    return null;
  }
  let agreementSum = 0;
  const categoryCounts = new Map<string, number>();
  let ratings = 0;
  for (const task of tasks) {
    const n = task.judgments.length;
    const counts = new Map<string, number>();
    for (const judgment of task.judgments) {
      counts.set(judgment.label, (counts.get(judgment.label) ?? 0) + 1);
      categoryCounts.set(judgment.label, (categoryCounts.get(judgment.label) ?? 0) + 1);
    }
    let pairSum = 0;
    for (const count of counts.values()) {
      pairSum += count * (count - 1);
    }
    agreementSum += pairSum / (n * (n - 1));
    ratings += n;
  }
  const observed = agreementSum / tasks.length;
  let chance = 0;
  for (const count of categoryCounts.values()) {
    const share = count / ratings;
    chance += share * share;
  }
  if (chance === 1) {
    return observed === 1 ? 1 : 0;
  }
  return round((observed - chance) / (1 - chance));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
