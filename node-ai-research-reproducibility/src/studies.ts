export const environments = ['lockfile', 'container', 'none'] as const;
export type EnvironmentPin = (typeof environments)[number];

export type Badge = 'incomplete' | 'functional' | 'reusable';

export interface StudyCheck {
  readonly code: 'data' | 'code' | 'environment' | 'seed' | 'command' | 'hardware' | 'license';
  readonly passed: boolean;
  readonly weight: number;
}

export interface Study {
  readonly id: string;
  readonly title: string;
  readonly method: 'reproducibility-rubric';
  readonly score: number;
  readonly badge: Badge;
  readonly checks: readonly StudyCheck[];
}

export interface StudyInput {
  readonly title: string;
  readonly data: boolean;
  readonly code: boolean;
  readonly environment: EnvironmentPin;
  readonly seed: boolean;
  readonly command: boolean;
  readonly hardware: boolean;
  readonly license: boolean;
}

export function isEnvironmentPin(value: unknown): value is EnvironmentPin {
  return typeof value === 'string' && environments.some((environment) => environment === value);
}

export function assessStudy(input: StudyInput, id: string): Study {
  const checks: StudyCheck[] = [
    { code: 'data', passed: input.data, weight: 20 },
    { code: 'code', passed: input.code, weight: 20 },
    { code: 'environment', passed: input.environment !== 'none', weight: 20 },
    { code: 'seed', passed: input.seed, weight: 10 },
    { code: 'command', passed: input.command, weight: 15 },
    { code: 'hardware', passed: input.hardware, weight: 5 },
    { code: 'license', passed: input.license, weight: 10 },
  ];
  const score = checks.reduce((total, check) => total + (check.passed ? check.weight : 0), 0);
  return {
    id,
    title: input.title,
    method: 'reproducibility-rubric',
    score,
    badge: badgeFor(input, score),
    checks,
  };
}

function badgeFor(input: StudyInput, score: number): Badge {
  if (
    score >= 80 &&
    input.data &&
    input.code &&
    input.environment !== 'none' &&
    input.command &&
    input.license
  ) {
    return 'reusable';
  }
  if (score >= 40 && input.code && input.command) {
    return 'functional';
  }
  return 'incomplete';
}
