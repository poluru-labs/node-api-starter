export const itemKinds = ['issue', 'pull'] as const;
export type ItemKind = (typeof itemKinds)[number];

export const queues = ['needs-info', 'ready', 'security', 'good-first-issue'] as const;
export type TriageQueue = (typeof queues)[number];

export const priorities = ['urgent', 'high', 'normal', 'low'] as const;
export type TriagePriority = (typeof priorities)[number];

export interface TriageReason {
  readonly code:
    | 'private_disclosure'
    | 'needs_reproduction'
    | 'needs_test'
    | 'small_docs_change'
    | 'ready_for_review';
  readonly message: string;
}

export interface SimilarItem {
  readonly id: string;
  readonly title: string;
  readonly score: number;
}

export interface TriageItem {
  readonly id: string;
  readonly kind: ItemKind;
  readonly title: string;
  readonly queue: TriageQueue;
  readonly priority: TriagePriority;
  readonly method: 'rule-triage';
  readonly reasons: readonly TriageReason[];
  readonly similar: readonly SimilarItem[];
}

export interface IncomingItem {
  readonly kind: ItemKind;
  readonly title: string;
  readonly body: string;
  readonly hasReproduction: boolean | null;
  readonly hasTest: boolean | null;
}

const stopwords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);
const securityPattern = /\b(cve(?:-\d{4}-\d+)?|vulnerability|rce)\b/i;

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === 'string' && itemKinds.some((kind) => kind === value);
}

export function isTriageQueue(value: unknown): value is TriageQueue {
  return typeof value === 'string' && queues.some((queue) => queue === value);
}

export function triageItem(
  existing: readonly TriageItem[],
  item: IncomingItem,
  id: string,
): TriageItem {
  const decision = classify(item);
  const similar = existing
    .map((prior) => ({
      id: prior.id,
      title: prior.title,
      score: round2(jaccard(prior.title, item.title)),
    }))
    .filter((prior) => prior.score >= 0.5)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 3);
  return { id, kind: item.kind, title: item.title, method: 'rule-triage', similar, ...decision };
}

function classify(item: IncomingItem): {
  queue: TriageQueue;
  priority: TriagePriority;
  reasons: TriageReason[];
} {
  if (securityPattern.test(item.title) || securityPattern.test(item.body)) {
    return {
      queue: 'security',
      priority: 'urgent',
      reasons: [
        {
          code: 'private_disclosure',
          message: 'Treat this as a security report and use the private disclosure path.',
        },
      ],
    };
  }
  if (item.kind === 'pull' && item.hasTest !== true) {
    return {
      queue: 'needs-info',
      priority: 'normal',
      reasons: [
        {
          code: 'needs_test',
          message: 'Add a test that fails before the change and passes after it.',
        },
      ],
    };
  }
  if (
    item.kind === 'issue' &&
    /bug|crash|error|fail/i.test(item.title) &&
    item.hasReproduction !== true
  ) {
    return {
      queue: 'needs-info',
      priority: 'high',
      reasons: [
        {
          code: 'needs_reproduction',
          message: 'Add steps, the expected result, and the actual result.',
        },
      ],
    };
  }
  if (/typo|readme|docs|comment/i.test(item.title) && item.body.length < 400) {
    return {
      queue: 'good-first-issue',
      priority: 'low',
      reasons: [
        { code: 'small_docs_change', message: 'This looks like a small documentation change.' },
      ],
    };
  }
  return {
    queue: 'ready',
    priority: 'normal',
    reasons: [
      {
        code: 'ready_for_review',
        message: 'The report has enough detail for a maintainer to review.',
      },
    ],
  };
}

function jaccard(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  return intersection / (a.size + b.size - intersection);
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stopwords.has(token)),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
