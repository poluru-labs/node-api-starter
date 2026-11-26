export const decisions = ['include', 'exclude', 'maybe'] as const;
export type ScreenDecision = (typeof decisions)[number];

export interface StudyRecord {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly decision: ScreenDecision;
  readonly reasons: readonly string[];
}

export interface ReviewProtocol {
  readonly id: string;
  readonly question: string;
  readonly includeTerms: readonly string[];
  readonly excludeTerms: readonly string[];
  readonly studies: readonly StudyRecord[];
}

export interface ReviewSummary {
  readonly method: 'term-screen';
  readonly identified: number;
  readonly included: number;
  readonly excluded: number;
  readonly maybe: number;
}

export function screenStudy(
  title: string,
  abstract: string,
  includeTerms: readonly string[],
  excludeTerms: readonly string[],
): { decision: ScreenDecision; reasons: string[] } {
  const haystack = `${title}\n${abstract}`.toLowerCase();
  const excluded = excludeTerms.filter((term) => haystack.includes(term.toLowerCase()));
  if (excluded.length > 0) {
    return { decision: 'exclude', reasons: excluded.map((term) => `exclude:${term}`) };
  }
  const matched = includeTerms.filter((term) => haystack.includes(term.toLowerCase()));
  if (matched.length === includeTerms.length) {
    return { decision: 'include', reasons: matched.map((term) => `include:${term}`) };
  }
  if (matched.length > 0) {
    return { decision: 'maybe', reasons: ['partial_match'] };
  }
  return { decision: 'exclude', reasons: ['missing_terms'] };
}

export function summarizeReview(review: ReviewProtocol): ReviewSummary {
  return {
    method: 'term-screen',
    identified: review.studies.length,
    included: review.studies.filter((study) => study.decision === 'include').length,
    excluded: review.studies.filter((study) => study.decision === 'exclude').length,
    maybe: review.studies.filter((study) => study.decision === 'maybe').length,
  };
}
