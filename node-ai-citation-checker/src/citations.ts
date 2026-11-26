const doiPattern = /^10\.\d{4,9}\/\S+$/;

export interface Reference {
  readonly authors: string;
  readonly year: number;
  readonly title: string;
  readonly doi?: string;
}

export interface CitationUse {
  readonly author: string;
  readonly year: number;
}

export interface CitationReport {
  readonly id: string;
  readonly inText: readonly CitationUse[];
  readonly unmatched: readonly CitationUse[];
  readonly uncited: readonly Reference[];
  readonly invalid: readonly { readonly index: number; readonly code: string }[];
  readonly ok: boolean;
}

export function checkCitations(
  text: string,
  references: readonly Reference[],
  id: string,
): CitationReport {
  const invalid: { index: number; code: string }[] = [];
  references.forEach((reference, index) => {
    if (reference.title.trim().length === 0) {
      invalid.push({ index, code: 'missing_title' });
    }
    if (reference.doi !== undefined && !doiPattern.test(reference.doi)) {
      invalid.push({ index, code: 'invalid_doi' });
    }
  });
  const inText = extractCitations(text);
  const unmatched = inText.filter(
    (citation) => !references.some((reference) => sameWork(reference, citation)),
  );
  const uncited = references.filter(
    (reference) => !inText.some((citation) => sameWork(reference, citation)),
  );
  return {
    id,
    inText,
    unmatched,
    uncited,
    invalid,
    ok: unmatched.length === 0 && uncited.length === 0 && invalid.length === 0,
  };
}

export function parseReferences(value: unknown): Reference[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
    return undefined;
  }
  const references: Reference[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return undefined;
    }
    const record = item as Record<string, unknown>;
    if (typeof record['authors'] !== 'string' || record['authors'].trim().length === 0) {
      return undefined;
    }
    if (typeof record['title'] !== 'string') {
      return undefined;
    }
    if (!isYear(record['year'])) {
      return undefined;
    }
    const reference: Reference = {
      authors: record['authors'].trim(),
      year: record['year'],
      title: record['title'].trim(),
    };
    if (record['doi'] !== undefined) {
      if (typeof record['doi'] !== 'string' || record['doi'].trim().length === 0) {
        return undefined;
      }
      references.push({ ...reference, doi: record['doi'].trim() });
    } else {
      references.push(reference);
    }
  }
  return references;
}

function extractCitations(text: string): CitationUse[] {
  const found: CitationUse[] = [];
  const seen = new Set<string>();
  const patterns = [/([A-Z][A-Za-z'’-]+)\s+\((\d{4})\)/g, /\(([A-Z][A-Za-z'’-]+),\s*(\d{4})\)/g];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const author = match[1];
      const year = Number(match[2]);
      if (author === undefined || !isYear(year)) {
        continue;
      }
      const key = `${author.toLowerCase()}:${String(year)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      found.push({ author, year });
    }
  }
  return found;
}

function sameWork(reference: Reference, citation: CitationUse): boolean {
  return (
    reference.year === citation.year &&
    surname(reference.authors).toLowerCase() === citation.author.toLowerCase()
  );
}

function surname(authors: string): string {
  const first = authors.split(/\s+(?:and|&)\s+/i)[0] ?? authors;
  if (first.includes(',')) {
    return first.split(',')[0]?.trim() ?? first;
  }
  const parts = first.trim().split(/\s+/);
  return parts.at(-1) ?? first;
}

function isYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 2100;
}
