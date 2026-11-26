export interface FairnessRow {
  readonly group: string;
  readonly label: 0 | 1;
  readonly prediction: 0 | 1;
}

export interface GroupMetrics {
  readonly group: string;
  readonly count: number;
  readonly positiveRate: number;
  readonly baseRate: number;
  readonly truePositiveRate: number | null;
  readonly falsePositiveRate: number | null;
}

export interface FairnessFinding {
  readonly code: 'disparate_impact' | 'equal_opportunity' | 'single_group' | 'small_sample';
  readonly message: string;
}

export interface FairnessReport {
  readonly id: string;
  readonly protectedAttribute: string;
  readonly ok: boolean;
  readonly reliable: boolean;
  readonly disparateImpact: number | null;
  readonly equalOpportunityGap: number | null;
  readonly groups: readonly GroupMetrics[];
  readonly findings: readonly FairnessFinding[];
}

export function assessFairness(
  protectedAttribute: string,
  rows: readonly FairnessRow[],
  id: string,
): FairnessReport {
  const grouped = new Map<string, FairnessRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.group) ?? [];
    bucket.push(row);
    grouped.set(row.group, bucket);
  }

  const groups = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([group, members]) => metricsFor(group, members));

  const rates = groups.map((group) => group.positiveRate);
  const maxRate = rates.length === 0 ? 0 : Math.max(...rates);
  const minRate = rates.length === 0 ? 0 : Math.min(...rates);
  const disparateImpact = maxRate === 0 ? null : round4(minRate / maxRate);

  const trueRates = groups
    .map((group) => group.truePositiveRate)
    .filter((rate): rate is number => rate !== null);
  const equalOpportunityGap =
    trueRates.length < 2 ? null : round4(Math.max(...trueRates) - Math.min(...trueRates));

  const findings: FairnessFinding[] = [];
  if (groups.length < 2) {
    findings.push({
      code: 'single_group',
      message: 'Fairness needs at least two groups.',
    });
  }
  if (disparateImpact !== null && disparateImpact < 0.8) {
    findings.push({
      code: 'disparate_impact',
      message: 'Selection rates fail the four-fifths rule.',
    });
  }
  if (equalOpportunityGap !== null && equalOpportunityGap > 0.1) {
    findings.push({
      code: 'equal_opportunity',
      message: 'True positive rates differ by more than 0.1.',
    });
  }
  if (groups.some((group) => group.count < 30)) {
    findings.push({
      code: 'small_sample',
      message: 'A group has fewer than 30 rows, so the rates are unstable.',
    });
  }

  const reliable = groups.length >= 2 && groups.every((group) => group.count >= 30);
  const blocking = findings.some((finding) => finding.code !== 'small_sample');
  return {
    id,
    protectedAttribute,
    ok: reliable && !blocking,
    reliable,
    disparateImpact,
    equalOpportunityGap,
    groups,
    findings,
  };
}

function metricsFor(group: string, rows: readonly FairnessRow[]): GroupMetrics {
  let positive = 0;
  let labeled = 0;
  let truePositive = 0;
  let positiveLabels = 0;
  let falsePositive = 0;
  let negativeLabels = 0;
  for (const row of rows) {
    if (row.prediction === 1) {
      positive += 1;
    }
    if (row.label === 1) {
      labeled += 1;
      positiveLabels += 1;
      if (row.prediction === 1) {
        truePositive += 1;
      }
    } else {
      negativeLabels += 1;
      if (row.prediction === 1) {
        falsePositive += 1;
      }
    }
  }
  return {
    group,
    count: rows.length,
    positiveRate: round4(rows.length === 0 ? 0 : positive / rows.length),
    baseRate: round4(rows.length === 0 ? 0 : labeled / rows.length),
    truePositiveRate: positiveLabels === 0 ? null : round4(truePositive / positiveLabels),
    falsePositiveRate: negativeLabels === 0 ? null : round4(falsePositive / negativeLabels),
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
