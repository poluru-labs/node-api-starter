export const skillIds = [
  'communication',
  'problem-solving',
  'collaboration',
  'digital-literacy',
] as const;
export type SkillId = (typeof skillIds)[number];

export interface SkillScore {
  readonly skillId: SkillId;
  readonly level: number;
  readonly evidence: string;
}

export interface SkillReport {
  readonly id: string;
  readonly learner: string;
  readonly method: 'competency-rubric';
  readonly targetLevel: number;
  readonly average: number;
  readonly met: boolean;
  readonly gaps: readonly SkillId[];
  readonly scores: readonly SkillScore[];
}

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && skillIds.some((skillId) => skillId === value);
}

export function assessSkills(
  learner: string,
  targetLevel: number,
  scores: readonly SkillScore[],
  id: string,
): SkillReport {
  const average = round2(scores.reduce((total, score) => total + score.level, 0) / scores.length);
  const gaps = scores
    .filter((score) => score.level < targetLevel)
    .map((score) => score.skillId)
    .sort((left, right) => left.localeCompare(right));
  return {
    id,
    learner,
    method: 'competency-rubric',
    targetLevel,
    average,
    met: gaps.length === 0,
    gaps,
    scores,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
