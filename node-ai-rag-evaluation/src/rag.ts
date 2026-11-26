export interface RagContext {
  readonly id: string;
  readonly text: string;
}

export interface RagReport {
  readonly id: string;
  readonly method: 'lexical-rag';
  readonly faithfulness: number;
  readonly answerRelevance: number;
  readonly contextRelevance: number;
  readonly citations: readonly string[];
  readonly unknownCitations: readonly string[];
  readonly ok: boolean;
}

const stopwords = new Set([
  'a',
  'an',
  'and',
  'are',
  'does',
  'for',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'was',
  'were',
  'what',
  'when',
  'where',
  'who',
  'with',
]);

export function evaluateRag(
  question: string,
  answer: string,
  contexts: readonly RagContext[],
  id: string,
): RagReport {
  const contextTokens = new Set(contexts.flatMap((context) => tokenize(context.text)));
  const answerTokens = tokenize(answer.replace(/\[[A-Za-z0-9_.:-]{1,40}\]/g, ' '));
  const questionTokens = tokenize(question);
  const known = new Set(contexts.map((context) => context.id));
  const citations = [
    ...new Set([...answer.matchAll(/\[([A-Za-z0-9_.:-]{1,40})\]/g)].map((match) => match[1] ?? '')),
  ].filter((citation) => citation.length > 0);
  const faithfulness = coverage(answerTokens, contextTokens);
  const answerRelevance = coverage(questionTokens, new Set(answerTokens));
  const contextRelevance = coverage(questionTokens, contextTokens);
  const unknownCitations = citations.filter((citation) => !known.has(citation));
  return {
    id,
    method: 'lexical-rag',
    faithfulness,
    answerRelevance,
    contextRelevance,
    citations,
    unknownCitations,
    ok: faithfulness >= 0.5 && unknownCitations.length === 0,
  };
}

function coverage(needles: readonly string[], haystack: ReadonlySet<string>): number {
  if (needles.length === 0) {
    return 0;
  }
  const found = needles.filter((token) => haystack.has(token)).length;
  return round4(found / needles.length);
}

function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !stopwords.has(token)),
    ),
  ];
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
