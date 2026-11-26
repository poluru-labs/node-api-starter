export interface Paper {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly year: number;
  readonly abstract: string;
  readonly keywords: readonly string[];
  readonly doi: string | null;
}

export interface PaperMatch {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export interface Discovery {
  readonly method: 'lexical-overlap';
  readonly query: string;
  readonly matches: readonly PaperMatch[];
}

const stopwords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

export function discoverPapers(
  papers: readonly Paper[],
  query: string,
  yearFrom: number | null,
  yearTo: number | null,
  limit: number,
): Discovery {
  const terms = tokenize(query);
  const matches = papers
    .filter((paper) => yearFrom === null || paper.year >= yearFrom)
    .filter((paper) => yearTo === null || paper.year <= yearTo)
    .map((paper) => scorePaper(paper, terms))
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || right.year - left.year || left.title.localeCompare(right.title),
    )
    .slice(0, limit);
  return { method: 'lexical-overlap', query, matches };
}

function scorePaper(paper: Paper, terms: readonly string[]): PaperMatch {
  const title = new Set(tokenize(paper.title));
  const keywords = new Set(paper.keywords.flatMap((keyword) => tokenize(keyword)));
  const abstract = new Set(tokenize(paper.abstract));
  const matched: string[] = [];
  let score = 0;
  for (const term of terms) {
    if (title.has(term)) {
      score += 3;
      matched.push(term);
    } else if (keywords.has(term)) {
      score += 2;
      matched.push(term);
    } else if (abstract.has(term)) {
      score += 1;
      matched.push(term);
    }
  }
  return {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    score,
    matchedTerms: matched.sort(),
  };
}

export function tokenize(text: string): string[] {
  const terms = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !stopwords.has(term));
  return [...new Set(terms)];
}
