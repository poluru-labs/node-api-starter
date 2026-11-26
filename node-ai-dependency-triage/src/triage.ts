export const severities = ['critical', 'high', 'moderate', 'low', 'none'] as const;
export type Severity = (typeof severities)[number];

export const failLevels = ['critical', 'high', 'moderate', 'low'] as const;
export type FailOn = (typeof failLevels)[number];

export interface Advisory {
  readonly id: string;
  readonly severity: Exclude<Severity, 'none'>;
}

export interface Dependency {
  readonly name: string;
  readonly version: string;
  readonly direct: boolean;
  readonly license: string | null;
  readonly deprecated: boolean;
  readonly latest: string | null;
  readonly advisories: readonly Advisory[];
}

export interface TriageFinding {
  readonly code: 'advisory' | 'deprecated' | 'license' | 'outdated' | 'duplicate';
  readonly name: string;
  readonly severity: Exclude<Severity, 'none'>;
  readonly message: string;
}

export interface TriageReport {
  readonly id: string;
  readonly ecosystem: string;
  readonly ok: boolean;
  readonly dependencyCount: number;
  readonly findings: readonly TriageFinding[];
}

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
  none: 0,
};

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && severities.some((severity) => severity === value);
}

export function isFailOn(value: unknown): value is FailOn {
  return typeof value === 'string' && failLevels.some((level) => level === value);
}

export function triageDependencies(
  ecosystem: string,
  failOn: FailOn,
  allowedLicenses: readonly string[] | null,
  dependencies: readonly Dependency[],
  id: string,
): TriageReport {
  const findings: TriageFinding[] = [];
  const versions = new Map<string, Set<string>>();

  for (const dependency of dependencies) {
    const seen = versions.get(dependency.name) ?? new Set<string>();
    seen.add(dependency.version);
    versions.set(dependency.name, seen);

    for (const advisory of dependency.advisories) {
      findings.push({
        code: 'advisory',
        name: dependency.name,
        severity: advisory.severity,
        message: `${dependency.name}@${dependency.version} is affected by ${advisory.id}.`,
      });
    }

    if (dependency.deprecated) {
      findings.push({
        code: 'deprecated',
        name: dependency.name,
        severity: dependency.direct ? 'moderate' : 'low',
        message: `${dependency.name}@${dependency.version} is deprecated.`,
      });
    }

    if (allowedLicenses !== null && !licenseAllowed(dependency.license, allowedLicenses)) {
      findings.push({
        code: 'license',
        name: dependency.name,
        severity: dependency.direct ? 'moderate' : 'low',
        message: `${dependency.name} license ${dependency.license ?? 'unknown'} is outside the allow list.`,
      });
    }

    const outdated = outdatedSeverity(dependency);
    if (outdated !== undefined) {
      findings.push({
        code: 'outdated',
        name: dependency.name,
        severity: outdated,
        message: `${dependency.name}@${dependency.version} is behind ${dependency.latest ?? dependency.version}.`,
      });
    }
  }

  for (const [name, seen] of versions) {
    if (seen.size > 1) {
      findings.push({
        code: 'duplicate',
        name,
        severity: 'low',
        message: `${name} is installed at ${String(seen.size)} versions.`,
      });
    }
  }

  findings.sort((left, right) => {
    const bySeverity = severityRank[right.severity] - severityRank[left.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }
    return left.name.localeCompare(right.name) || left.code.localeCompare(right.code);
  });

  const threshold = severityRank[failOn];
  return {
    id,
    ecosystem,
    ok: findings.every((finding) => severityRank[finding.severity] < threshold),
    dependencyCount: dependencies.length,
    findings,
  };
}

function licenseAllowed(license: string | null, allowed: readonly string[]): boolean {
  if (license === null) {
    return false;
  }
  const normalized = license.trim().toUpperCase();
  return allowed.some((entry) => entry.trim().toUpperCase() === normalized);
}

function outdatedSeverity(dependency: Dependency): Exclude<Severity, 'none'> | undefined {
  if (dependency.latest === null || dependency.latest === dependency.version) {
    return undefined;
  }
  const current = parseVersion(dependency.version);
  const latest = parseVersion(dependency.latest);
  if (current === undefined || latest === undefined || compareVersion(latest, current) <= 0) {
    return undefined;
  }
  if (latest[0] > current[0]) {
    return dependency.direct ? 'moderate' : 'low';
  }
  return 'low';
}

function parseVersion(value: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (match === null) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
