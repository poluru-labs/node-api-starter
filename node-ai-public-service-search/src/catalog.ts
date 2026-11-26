export const channels = ['online', 'phone', 'office', 'mail'] as const;
export type ServiceChannel = (typeof channels)[number];

export interface PublicService {
  readonly id: string;
  readonly name: string;
  readonly agency: string;
  readonly category: string;
  readonly area: string | null;
  readonly eligibility: readonly string[];
  readonly channel: ServiceChannel;
}

export interface ServiceMatch {
  readonly id: string;
  readonly name: string;
  readonly agency: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export interface ServiceSearch {
  readonly method: 'lexical-overlap';
  readonly matches: readonly ServiceMatch[];
}

const stopwords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

export function isServiceChannel(value: unknown): value is ServiceChannel {
  return typeof value === 'string' && channels.some((channel) => channel === value);
}

export function searchServices(
  services: readonly PublicService[],
  query: string,
  area: string | null,
  category: string | null,
  limit: number,
): ServiceSearch {
  const terms = tokenize(query);
  const matches = services
    .filter((service) => category === null || service.category === category)
    .filter((service) => area === null || service.area === null || service.area === area)
    .map((service) => scoreService(service, terms))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, limit);
  return { method: 'lexical-overlap', matches };
}

function scoreService(service: PublicService, terms: readonly string[]): ServiceMatch {
  const name = new Set(tokenize(service.name));
  const category = new Set(tokenize(service.category));
  const eligibility = new Set(service.eligibility.flatMap((item) => tokenize(item)));
  const matched: string[] = [];
  let score = 0;
  for (const term of terms) {
    if (name.has(term)) {
      score += 3;
      matched.push(term);
    } else if (category.has(term)) {
      score += 2;
      matched.push(term);
    } else if (eligibility.has(term)) {
      score += 1;
      matched.push(term);
    }
  }
  return {
    id: service.id,
    name: service.name,
    agency: service.agency,
    score,
    matchedTerms: matched.sort(),
  };
}

function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2 && !stopwords.has(term)),
    ),
  ];
}
