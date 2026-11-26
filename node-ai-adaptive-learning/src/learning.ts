export const skills = [
  { id: 'foundations', title: 'Foundations' },
  { id: 'practice', title: 'Guided practice' },
  { id: 'transfer', title: 'Transfer' },
] as const;

export type SkillId = (typeof skills)[number]['id'];

export interface AttemptInput {
  readonly skillId: SkillId;
  readonly correct: boolean;
  readonly difficulty: number;
}

export interface Learner {
  readonly id: string;
  readonly name: string;
  readonly attempts: number;
  readonly mastery: Readonly<Record<SkillId, number>>;
}

export interface Recommendation {
  readonly learnerId: string;
  readonly skillId: SkillId;
  readonly title: string;
  readonly difficulty: number;
  readonly mastery: number;
  readonly reason: string;
}

export function emptyMastery(): Record<SkillId, number> {
  return { foundations: 0, practice: 0, transfer: 0 };
}

export function isSkillId(value: unknown): value is SkillId {
  return skills.some((skill) => skill.id === value);
}

export function applyAttempt(current: number, attempt: AttemptInput): number {
  const weight = attempt.difficulty / 5;
  const delta = attempt.correct ? 0.25 * weight : -0.2 * weight;
  return round(clamp(current + delta));
}

export function recommend(learner: Learner): Recommendation {
  const ranked = skills.map((skill) => ({ skill, mastery: learner.mastery[skill.id] }));
  ranked.sort((left, right) => left.mastery - right.mastery);
  const next = ranked[0];
  if (next === undefined) {
    throw new Error('The skill catalog is empty');
  }
  const difficulty = Math.min(5, Math.max(1, Math.round(1 + next.mastery * 4)));
  return {
    learnerId: learner.id,
    skillId: next.skill.id,
    title: next.skill.title,
    difficulty,
    mastery: round(next.mastery),
    reason:
      learner.attempts === 0
        ? 'No attempts yet. Start with the first skill.'
        : 'This skill has the lowest mastery.',
  };
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
