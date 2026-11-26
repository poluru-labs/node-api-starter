export const docKinds = ['readme', 'api', 'changelog', 'contributing'] as const;
export type DocKind = (typeof docKinds)[number];

export type DocImpact = 'serious' | 'moderate' | 'minor';

export interface DocFinding {
  readonly code:
    | 'missing_title'
    | 'missing_section'
    | 'unclosed_fence'
    | 'empty_link'
    | 'image_alt'
    | 'todo'
    | 'missing_http'
    | 'missing_status'
    | 'missing_version'
    | 'missing_date'
    | 'missing_tests'
    | 'missing_conduct';
  readonly impact: DocImpact;
  readonly message: string;
}

export interface DocReport {
  readonly id: string;
  readonly kind: DocKind;
  readonly ok: boolean;
  readonly findings: readonly DocFinding[];
}

const readmeSections: readonly (readonly string[])[] = [
  ['install', 'getting started'],
  ['usage', 'example'],
  ['license'],
];

export function isDocKind(value: unknown): value is DocKind {
  return typeof value === 'string' && docKinds.some((kind) => kind === value);
}

export function checkDocumentation(kind: DocKind, text: string, id: string): DocReport {
  const headings = readHeadings(text);
  const findings: DocFinding[] = [];

  if (kind === 'readme') {
    if (!headings.some((heading) => heading.level === 1)) {
      findings.push({
        code: 'missing_title',
        impact: 'serious',
        message: 'A README needs a level-1 heading.',
      });
    }
    for (const group of readmeSections) {
      if (!headings.some((heading) => group.some((name) => heading.text.includes(name)))) {
        findings.push({
          code: 'missing_section',
          impact: 'serious',
          message: `A README needs a section for ${group.join(' or ')}.`,
        });
      }
    }
  }

  if (kind === 'api') {
    if (!/\b(GET|POST|PUT|PATCH|DELETE)\b/.test(text)) {
      findings.push({
        code: 'missing_http',
        impact: 'serious',
        message: 'API docs need at least one HTTP method.',
      });
    }
    if (!/\b(200|201|400|404|response|status)\b/i.test(text)) {
      findings.push({
        code: 'missing_status',
        impact: 'serious',
        message: 'API docs need a status or response description.',
      });
    }
  }

  if (kind === 'changelog') {
    if (!headings.some((heading) => /v?\d+\.\d+\.\d+/.test(heading.text))) {
      findings.push({
        code: 'missing_version',
        impact: 'serious',
        message: 'A changelog needs a version heading such as 1.2.0.',
      });
    }
    if (!/\b\d{4}-\d{2}-\d{2}\b/.test(text)) {
      findings.push({
        code: 'missing_date',
        impact: 'moderate',
        message: 'A changelog needs an ISO date.',
      });
    }
  }

  if (kind === 'contributing') {
    if (!/\btests?\b/i.test(text)) {
      findings.push({
        code: 'missing_tests',
        impact: 'serious',
        message: 'Contributing docs need to say how to run tests.',
      });
    }
    if (!/code of conduct/i.test(text)) {
      findings.push({
        code: 'missing_conduct',
        impact: 'moderate',
        message: 'Contributing docs should point to the code of conduct.',
      });
    }
  }

  if ((text.match(/```/g) ?? []).length % 2 === 1) {
    findings.push({
      code: 'unclosed_fence',
      impact: 'serious',
      message: 'A code fence is missing its closing marks.',
    });
  }
  if (/!\[[ \t]*\]\(/.test(text)) {
    findings.push({
      code: 'image_alt',
      impact: 'moderate',
      message: 'An image is missing alternative text.',
    });
  }
  if (/(?<!!)\[[^\]]+\]\(\s*\)/.test(text)) {
    findings.push({
      code: 'empty_link',
      impact: 'moderate',
      message: 'A link is missing its destination.',
    });
  }
  if (/\b(TODO|FIXME)\b/.test(text)) {
    findings.push({
      code: 'todo',
      impact: 'minor',
      message: 'The document still contains TODO or FIXME.',
    });
  }

  return {
    id,
    kind,
    ok: findings.every((item) => item.impact === 'minor'),
    findings,
  };
}

function readHeadings(text: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  for (const line of text.split('\n')) {
    const match = /^(#{1,6})\s+(\S.*)$/.exec(line.trim());
    const marks = match?.[1];
    const title = match?.[2];
    if (marks !== undefined && title !== undefined) {
      headings.push({ level: marks.length, text: title.trim().toLowerCase() });
    }
  }
  return headings;
}
