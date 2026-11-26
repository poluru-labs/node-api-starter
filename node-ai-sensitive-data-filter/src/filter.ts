export const sensitiveKinds = ['email', 'phone', 'ssn', 'card', 'secret'] as const;
export type SensitiveKind = (typeof sensitiveKinds)[number];

export interface SensitiveFinding {
  readonly kind: SensitiveKind;
  readonly count: number;
}

export interface FilterReport {
  readonly id: string;
  readonly method: 'pattern-redaction';
  readonly ok: boolean;
  readonly redacted: string;
  readonly findings: readonly SensitiveFinding[];
}

interface Hit {
  readonly start: number;
  readonly end: number;
  readonly kind: SensitiveKind;
}

export function isSensitiveKind(value: unknown): value is SensitiveKind {
  return typeof value === 'string' && sensitiveKinds.some((kind) => kind === value);
}

export function filterSensitive(
  text: string,
  enabled: readonly SensitiveKind[],
  id: string,
): FilterReport {
  const selected = new Set(enabled);
  const hits = collect(text).filter((hit) => selected.has(hit.kind));
  const kept = dropOverlaps(hits);
  let redacted = '';
  let cursor = 0;
  const counts = new Map<SensitiveKind, number>();
  for (const hit of kept) {
    redacted += text.slice(cursor, hit.start) + `[redacted:${hit.kind}]`;
    cursor = hit.end;
    counts.set(hit.kind, (counts.get(hit.kind) ?? 0) + 1);
  }
  redacted += text.slice(cursor);
  const findings = [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
  return { id, method: 'pattern-redaction', ok: findings.length === 0, redacted, findings };
}

function collect(text: string): Hit[] {
  const hits: Hit[] = [];
  addPattern(hits, text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'email');
  addPattern(hits, text, /\b\d{3}-\d{2}-\d{4}\b/g, 'ssn');
  addPattern(hits, text, /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, 'phone');
  addPattern(hits, text, /\bAKIA[0-9A-Z]{16}\b/g, 'secret');
  addPattern(hits, text, /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/g, 'secret');
  for (const match of text.matchAll(/\d(?:[ -]?\d){12,18}/g)) {
    const raw = match[0];
    const digits = raw.replace(/\D/g, '');
    if (match.index !== undefined && digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      hits.push({ start: match.index, end: match.index + raw.length, kind: 'card' });
    }
  }
  return hits;
}

function addPattern(hits: Hit[], text: string, pattern: RegExp, kind: SensitiveKind): void {
  for (const match of text.matchAll(pattern)) {
    if (match.index !== undefined) {
      hits.push({ start: match.index, end: match.index + match[0].length, kind });
    }
  }
}

function dropOverlaps(hits: readonly Hit[]): Hit[] {
  const ordered = [...hits].sort((left, right) => left.start - right.start || right.end - left.end);
  const kept: Hit[] = [];
  let cursor = 0;
  for (const hit of ordered) {
    if (hit.start >= cursor) {
      kept.push(hit);
      cursor = hit.end;
    }
  }
  return kept;
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = digits.charCodeAt(index) - 48;
    if (alternate) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}
