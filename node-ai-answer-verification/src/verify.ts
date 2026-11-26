const stopwords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

export interface Source {
  readonly id: string;
  readonly text: string;
}

export interface ClaimCheck {
  readonly text: string;
  readonly status: 'supported' | 'partial' | 'unsupported';
  readonly sourceId: string | null;
  readonly score: number;
}

export interface Verification {
  readonly id: string;
  readonly question: string;
  readonly verdict: 'supported' | 'partial' | 'unsupported';
  readonly coverage: number;
  readonly method: 'lexical-overlap';
  readonly claims: readonly ClaimCheck[];
}

export function verifyAnswer(input: {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly sources: readonly Source[];
}): Verification {
  const claims = splitSentences(input.answer).map((sentence) =>
    checkSentence(sentence, input.sources),
  );
  const supported = claims.filter((claim) => claim.status === 'supported').length;
  const coverage = claims.length === 0 ? 0 : round(supported / claims.length);
  let verdict: Verification['verdict'] = 'partial';
  if (claims.length > 0 && claims.every((claim) => claim.status === 'supported')) {
    verdict = 'supported';
  } else if (claims.every((claim) => claim.status === 'unsupported')) {
    verdict = 'unsupported';
  }
  return {
    id: input.id,
    question: input.question,
    verdict,
    coverage,
    method: 'lexical-overlap',
    claims,
  };
}

function checkSentence(sentence: string, sources: readonly Source[]): ClaimCheck {
  const cited = citedSource(sentence, sources);
  let bestScore = 0;
  let bestId: string | null = null;
  for (const source of sources) {
    for (const passage of splitSentences(source.text)) {
      const score = jaccard(tokens(sentence), tokens(passage));
      if (score > bestScore) {
        bestScore = score;
        bestId = source.id;
      }
    }
  }
  const score = round(bestScore);
  const sourceId = cited?.id ?? bestId;
  if (score >= 0.45 || (cited !== undefined && score >= 0.2)) {
    return { text: sentence, status: 'supported', sourceId, score };
  }
  if (score >= 0.2) {
    return { text: sentence, status: 'partial', sourceId, score };
  }
  return { text: sentence, status: 'unsupported', sourceId, score };
}

function citedSource(sentence: string, sources: readonly Source[]): Source | undefined {
  return sources.find((source) => sentence.includes(`[${source.id}]`));
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length === 0 ? [] : parts;
}

function tokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
  return new Set(words);
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const word of left) {
    if (right.has(word)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
