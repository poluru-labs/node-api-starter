export const audiences = ['general', 'expert'] as const;
export type Audience = (typeof audiences)[number];

export interface PlainFinding {
  readonly code: 'long_sentence' | 'passive' | 'jargon';
  readonly message: string;
}

export interface PlainReport {
  readonly id: string;
  readonly method: 'plain-language';
  readonly audience: Audience;
  readonly averageSentenceWords: number;
  readonly score: number;
  readonly findings: readonly PlainFinding[];
  readonly plain: string;
}

const replacements: readonly (readonly [RegExp, string, string])[] = [
  [/\bin the event that\b/gi, 'if', 'in the event that'],
  [/\bin order to\b/gi, 'to', 'in order to'],
  [/\bprior to\b/gi, 'before', 'prior to'],
  [/\bpursuant to\b/gi, 'under', 'pursuant to'],
  [/\bindividuals\b/gi, 'people', 'individuals'],
  [/\butilize\b/gi, 'use', 'utilize'],
  [/\bleverage\b/gi, 'use', 'leverage'],
  [/\bcommence\b/gi, 'start', 'commence'],
  [/\bterminate\b/gi, 'end', 'terminate'],
  [/\bfacilitate\b/gi, 'help', 'facilitate'],
];

const passive = /\b(?:am|is|are|was|were|be|been|being)\s+\w+ed\b/i;

export function isAudience(value: unknown): value is Audience {
  return typeof value === 'string' && audiences.some((audience) => audience === value);
}

export function rewritePlain(text: string, audience: Audience, id: string): PlainReport {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const words = sentences.reduce((total, sentence) => total + wordCount(sentence), 0);
  const limit = audience === 'general' ? 20 : 30;
  const findings: PlainFinding[] = [];
  if (sentences.some((sentence) => wordCount(sentence) > limit)) {
    findings.push({
      code: 'long_sentence',
      message: `A sentence is longer than ${String(limit)} words.`,
    });
  }
  if (passive.test(text)) {
    findings.push({
      code: 'passive',
      message: 'A sentence uses a passive form such as "was submitted".',
    });
  }
  for (const [pattern, , label] of replacements) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      findings.push({ code: 'jargon', message: `Replace "${label}".` });
    }
  }
  let plain = text;
  for (const [pattern, replacement] of replacements) {
    pattern.lastIndex = 0;
    plain = plain.replace(pattern, replacement);
  }
  const penalty = findings.reduce(
    (total, finding) => total + (finding.code === 'jargon' ? 5 : 8),
    0,
  );
  return {
    id,
    method: 'plain-language',
    audience,
    averageSentenceWords: round1(sentences.length === 0 ? 0 : words / sentences.length),
    score: Math.max(0, 100 - penalty),
    findings,
    plain,
  };
}

function wordCount(sentence: string): number {
  const words = sentence.match(/[A-Za-z0-9']+/g);
  return words === null ? 0 : words.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
