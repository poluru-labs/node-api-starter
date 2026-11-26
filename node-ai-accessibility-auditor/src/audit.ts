export const conformanceLevels = ['A', 'AA', 'AAA'] as const;
export type ConformanceLevel = (typeof conformanceLevels)[number];

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface Finding {
  readonly rule: string;
  readonly impact: Impact;
  readonly wcag: string;
  readonly message: string;
}

export interface AuditSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly passes: number;
}

export interface AuditReport {
  readonly id: string;
  readonly createdAt: string;
  readonly level: ConformanceLevel;
  readonly score: number;
  readonly summary: AuditSummary;
  readonly findings: readonly Finding[];
}

const impactWeight: Record<Impact, number> = {
  critical: 25,
  serious: 15,
  moderate: 8,
  minor: 3,
};

const maxHtmlChars = 200_000;

export function isConformanceLevel(value: unknown): value is ConformanceLevel {
  return typeof value === 'string' && conformanceLevels.some((level) => level === value);
}

export function buildAudit(
  html: string,
  level: ConformanceLevel,
  id: string,
  createdAt: string,
): AuditReport {
  const source = html.slice(0, maxHtmlChars);
  const findings: Finding[] = [];
  let passes = 0;

  const check = (minimum: ConformanceLevel, finding: Finding | undefined): void => {
    if (!levelApplies(level, minimum)) {
      return;
    }
    if (finding === undefined) {
      passes += 1;
      return;
    }
    findings.push(finding);
  };

  check('A', documentLanguage(source));
  check('A', documentTitle(source));
  check('A', imageAlts(source));
  check(
    'A',
    namedControls(source, 'button', 'button-name', '4.1.2', 'Button has no accessible name.'),
  );
  check('A', linkNames(source));
  check('A', formLabels(source));
  check('A', duplicateIds(source));
  check('A', mainLandmark(source));
  check('AA', headingOrder(source));
  check('AA', viewportZoom(source));
  check('AAA', positiveTabindex(source));

  const errors = findings.filter(
    (finding) => finding.impact === 'critical' || finding.impact === 'serious',
  ).length;
  const warnings = findings.length - errors;
  const penalty = findings.reduce((total, finding) => total + impactWeight[finding.impact], 0);

  return {
    id,
    createdAt,
    level,
    score: Math.max(0, 100 - penalty),
    summary: { errors, warnings, passes },
    findings,
  };
}

function levelApplies(selected: ConformanceLevel, minimum: ConformanceLevel): boolean {
  return conformanceLevels.indexOf(selected) >= conformanceLevels.indexOf(minimum);
}

function documentLanguage(html: string): Finding | undefined {
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0];
  const lang = htmlTag === undefined ? undefined : attr(htmlTag, 'lang');
  if (lang !== undefined && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(lang)) {
    return undefined;
  }
  return finding('html-lang', 'serious', '3.1.1', 'The html element needs a valid lang attribute.');
}

function documentTitle(html: string): Finding | undefined {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  if (title.length > 0) {
    return undefined;
  }
  return finding('document-title', 'critical', '2.4.2', 'The page needs a non-empty title.');
}

function imageAlts(html: string): Finding | undefined {
  const missing = openTags(html, 'img').some((tag) => attr(tag, 'alt') === undefined);
  if (!missing) {
    return undefined;
  }
  return finding('image-alt', 'critical', '1.1.1', 'Every img needs an alt attribute.');
}

function linkNames(html: string): Finding | undefined {
  const unnamed = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some((match) => {
    const open = `<a${match[1] ?? ''}>`;
    if (attr(open, 'href') === undefined) {
      return false;
    }
    return !hasAccessibleName(open, match[2] ?? '');
  });
  if (!unnamed) {
    return undefined;
  }
  return finding('link-name', 'serious', '2.4.4', 'Every link needs an accessible name.');
}

function namedControls(
  html: string,
  tagName: string,
  rule: string,
  wcag: string,
  message: string,
): Finding | undefined {
  const unnamed = [
    ...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'gi')),
  ].some((match) => !hasAccessibleName(`<${tagName}${match[1] ?? ''}>`, match[2] ?? ''));
  if (!unnamed) {
    return undefined;
  }
  return finding(rule, 'serious', wcag, message);
}

function formLabels(html: string): Finding | undefined {
  const unlabeled = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)].some((match) => {
    const tag = match[0] ?? '';
    if (match[1]?.toLowerCase() === 'input') {
      const type = (attr(tag, 'type') ?? 'text').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') {
        return false;
      }
    }
    if (attr(tag, 'aria-label') !== undefined || attr(tag, 'aria-labelledby') !== undefined) {
      return false;
    }
    const id = attr(tag, 'id');
    if (id === undefined) {
      return true;
    }
    const label = new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escapeRegExp(id)}["']`, 'i');
    return !label.test(html);
  });
  if (!unlabeled) {
    return undefined;
  }
  return finding(
    'label',
    'serious',
    '1.3.1',
    'Every form field needs a label, aria-label, or aria-labelledby.',
  );
}

function duplicateIds(html: string): Finding | undefined {
  const seen = new Set<string>();
  for (const match of html.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
    const id = match[1] ?? match[2] ?? '';
    if (id.length === 0) {
      continue;
    }
    if (seen.has(id)) {
      return finding('duplicate-id', 'serious', '4.1.1', `The id "${id}" is used more than once.`);
    }
    seen.add(id);
  }
  return undefined;
}

function mainLandmark(html: string): Finding | undefined {
  if (/<main\b/i.test(html)) {
    return undefined;
  }
  return finding('landmark-main', 'moderate', '2.4.1', 'The page needs a main landmark.');
}

function headingOrder(html: string): Finding | undefined {
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  let previous = 0;
  for (const level of levels) {
    if (previous > 0 && level > previous + 1) {
      return finding(
        'heading-order',
        'moderate',
        '1.3.1',
        'Heading levels should not skip, for example from h1 to h3.',
      );
    }
    previous = level;
  }
  return undefined;
}

function viewportZoom(html: string): Finding | undefined {
  const viewport = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0] ?? '')
    .find((tag) => attr(tag, 'name')?.toLowerCase() === 'viewport');
  if (viewport === undefined) {
    return undefined;
  }
  const content = (attr(viewport, 'content') ?? '').toLowerCase().replace(/\s+/g, '');
  if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
    return finding('meta-viewport', 'serious', '1.4.4', 'The viewport must allow users to zoom.');
  }
  return undefined;
}

function positiveTabindex(html: string): Finding | undefined {
  const positive = [...html.matchAll(/\btabindex\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)].some(
    (match) => {
      const raw = match[1] ?? match[2] ?? match[3] ?? '';
      return Number(raw) > 0;
    },
  );
  if (!positive) {
    return undefined;
  }
  return finding(
    'tabindex',
    'moderate',
    '2.4.3',
    'tabindex values greater than 0 disrupt the focus order.',
  );
}

function hasAccessibleName(openTag: string, inner: string): boolean {
  if (attr(openTag, 'aria-label') !== undefined || attr(openTag, 'aria-labelledby') !== undefined) {
    return true;
  }
  return inner.replace(/<[^>]+>/g, ' ').trim().length > 0;
}

function openTags(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0] ?? '');
}

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i').exec(
    tag,
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  if (value === undefined) {
    return undefined;
  }
  return value;
}

function finding(rule: string, impact: Impact, wcag: string, message: string): Finding {
  return { rule, impact, wcag, message };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
