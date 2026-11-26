export interface Activity {
  readonly id: string;
  readonly name: string;
  readonly output: string;
  readonly outcome: string | null;
  readonly beneficiaries: number;
  readonly costUsd: number;
  readonly period: string;
}

export interface ActivityShare {
  readonly id: string;
  readonly name: string;
  readonly beneficiaries: number;
  readonly costUsd: number;
  readonly costShare: number;
  readonly hasOutcome: boolean;
}

export interface ImpactSummary {
  readonly method: 'activity-sum';
  readonly beneficiaryMethod: 'sum-of-activities';
  readonly activityCount: number;
  readonly totalBeneficiaries: number;
  readonly totalCostUsd: number;
  readonly costPerBeneficiary: number | null;
  readonly missingOutcomes: number;
  readonly activities: readonly ActivityShare[];
}

export interface Program {
  readonly id: string;
  readonly name: string;
  readonly mission: string;
  readonly activities: readonly Activity[];
}

export function summarizeImpact(program: Program): ImpactSummary {
  const totalBeneficiaries = program.activities.reduce(
    (total, activity) => total + activity.beneficiaries,
    0,
  );
  const totalCostUsd = round2(
    program.activities.reduce((total, activity) => total + activity.costUsd, 0),
  );
  return {
    method: 'activity-sum',
    beneficiaryMethod: 'sum-of-activities',
    activityCount: program.activities.length,
    totalBeneficiaries,
    totalCostUsd,
    costPerBeneficiary: totalBeneficiaries === 0 ? null : round2(totalCostUsd / totalBeneficiaries),
    missingOutcomes: program.activities.filter((activity) => activity.outcome === null).length,
    activities: program.activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      beneficiaries: activity.beneficiaries,
      costUsd: round2(activity.costUsd),
      costShare: totalCostUsd === 0 ? 0 : round4(activity.costUsd / totalCostUsd),
      hasOutcome: activity.outcome !== null,
    })),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
