const replacements: readonly (readonly [string, string])[] = [
  ['in order to', 'to'],
  ['prior to', 'before'],
  ['individuals', 'people'],
  ['utilize', 'use'],
  ['approximately', 'about'],
  ['additional', 'more'],
  ['assistance', 'help'],
  ['requirement', 'need'],
  ['regarding', 'about'],
  ['sufficient', 'enough'],
  ['obtain', 'get'],
  ['provide', 'give'],
  ['however', 'but'],
  ['therefore', 'so'],
  ['demonstrate', 'show'],
];

export interface ReadingFlag {
  readonly kind: 'long-sentence' | 'hard-word';
  readonly text: string;
}

export interface ReadingReport {
  readonly id: string;
  readonly gradeLevel: number;
  readonly readingEase: number;
  readonly sentences: number;
  readonly words: number;
  readonly syllables: number;
  readonly targetGrade: number | null;
  readonly flags: readonly ReadingFlag[];
  readonly simplified: string;
}

export function analyzeReading(
  text: string,
  targetGrade: number | null,
  id: string,
): ReadingReport {
  const sentences = splitSentences(text);
  const wordList = words(text);
  const syllableCount = wordList.reduce((total, word) => total + syllables(word), 0);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = Math.max(1, wordList.length);
  const gradeLevel = round(
    0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59,
  );
  const readingEase = round(
    206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount),
  );
  const flags: ReadingFlag[] = [];
  for (const sentence of sentences) {
    if (words(sentence).length > 20) {
      flags.push({ kind: 'long-sentence', text: sentence });
    }
  }
  for (const word of wordList) {
    if (syllables(word) >= 4) {
      flags.push({ kind: 'hard-word', text: word });
    }
  }
  const simplified =
    targetGrade !== null && gradeLevel > targetGrade ? simplify(text) : text.trim();
  return {
    id,
    gradeLevel,
    readingEase,
    sentences: sentences.length,
    words: wordList.length,
    syllables: syllableCount,
    targetGrade,
    flags,
    simplified,
  };
}

function simplify(text: string): string {
  let next = text;
  for (const [from, to] of replacements) {
    next = next.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
  }
  return next.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length === 0 ? [text.trim()] : parts;
}

function words(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z']*/g) ?? [];
}

function syllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) {
    return 1;
  }
  const groups = cleaned.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
