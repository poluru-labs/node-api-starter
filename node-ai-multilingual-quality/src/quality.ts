export type QualityImpact = 'serious' | 'moderate' | 'minor';

export interface SegmentFinding {
  readonly segmentId: string;
  readonly code:
    | 'empty_target'
    | 'untranslated'
    | 'placeholder_mismatch'
    | 'number_mismatch'
    | 'length_ratio'
    | 'whitespace';
  readonly impact: QualityImpact;
  readonly message: string;
}

export interface Segment {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface QualityReport {
  readonly id: string;
  readonly method: 'deterministic-checks';
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly segmentCount: number;
  readonly score: number;
  readonly ok: boolean;
  readonly findings: readonly SegmentFinding[];
}

const impactWeight: Record<QualityImpact, number> = {
  serious: 15,
  moderate: 8,
  minor: 3,
};

const placeholder = /\{\{[^{}]+\}\}|\{[^{}]+\}|%[0-9]*\$?[sdif]/g;
const numberToken = /\d+(?:\.\d+)?/g;

export function reviewTranslation(
  sourceLocale: string,
  targetLocale: string,
  segments: readonly Segment[],
  id: string,
): QualityReport {
  const findings: SegmentFinding[] = [];
  for (const segment of segments) {
    reviewSegment(findings, segment, sourceLocale !== targetLocale);
  }
  const penalty = findings.reduce((total, finding) => total + impactWeight[finding.impact], 0);
  return {
    id,
    method: 'deterministic-checks',
    sourceLocale,
    targetLocale,
    segmentCount: segments.length,
    score: Math.max(0, 100 - penalty),
    ok: findings.every((finding) => finding.impact === 'minor'),
    findings,
  };
}

function reviewSegment(
  findings: SegmentFinding[],
  segment: Segment,
  differentLocale: boolean,
): void {
  if (segment.target.trim().length === 0) {
    findings.push(finding(segment.id, 'empty_target', 'serious', 'The target segment is empty.'));
    return;
  }
  if (
    differentLocale &&
    segment.source.trim() === segment.target.trim() &&
    /[A-Za-z]/.test(segment.source) &&
    segment.source.trim().length > 2
  ) {
    findings.push(finding(segment.id, 'untranslated', 'serious', 'The target repeats the source.'));
  }
  if (countTokens(segment.source, placeholder) !== countTokens(segment.target, placeholder)) {
    findings.push(
      finding(
        segment.id,
        'placeholder_mismatch',
        'serious',
        'Placeholders differ between source and target.',
      ),
    );
  }
  if (!numbersCovered(segment.source, segment.target)) {
    findings.push(
      finding(
        segment.id,
        'number_mismatch',
        'moderate',
        'A number from the source is missing in the target.',
      ),
    );
  }
  const sourceLength = segment.source.trim().length;
  const targetLength = segment.target.trim().length;
  if (
    sourceLength >= 20 &&
    (targetLength < sourceLength * 0.4 || targetLength > sourceLength * 2.5)
  ) {
    findings.push(
      finding(
        segment.id,
        'length_ratio',
        'moderate',
        'The target length is far from the source length.',
      ),
    );
  }
  if (
    segment.source.startsWith(' ') !== segment.target.startsWith(' ') ||
    segment.source.endsWith(' ') !== segment.target.endsWith(' ')
  ) {
    findings.push(
      finding(segment.id, 'whitespace', 'minor', 'Leading or trailing whitespace differs.'),
    );
  }
}

function countTokens(text: string, pattern: RegExp): string {
  return [...text.matchAll(pattern)]
    .map((match) => match[0] ?? '')
    .sort()
    .join('\u0000');
}

function numbersCovered(source: string, target: string): boolean {
  const needed = [...source.matchAll(numberToken)].map((match) => match[0] ?? '');
  const have = new Map<string, number>();
  for (const match of target.matchAll(numberToken)) {
    const token = match[0] ?? '';
    have.set(token, (have.get(token) ?? 0) + 1);
  }
  for (const token of needed) {
    const count = have.get(token) ?? 0;
    if (count === 0) {
      return false;
    }
    have.set(token, count - 1);
  }
  return true;
}

function finding(
  segmentId: string,
  code: SegmentFinding['code'],
  impact: QualityImpact,
  message: string,
): SegmentFinding {
  return { segmentId, code, impact, message };
}
