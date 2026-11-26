export interface RankedQuery {
  readonly id: string;
  readonly relevant: readonly string[];
  readonly ranked: readonly string[];
}

export interface RetrievalReport {
  readonly id: string;
  readonly name: string;
  readonly method: 'ranked-metrics';
  readonly k: number;
  readonly queryCount: number;
  readonly precisionAtK: number;
  readonly recallAtK: number;
  readonly mrr: number;
  readonly ndcgAtK: number;
  readonly hitRate: number;
}

export function scoreRetrieval(
  name: string,
  k: number,
  queries: readonly RankedQuery[],
  id: string,
): RetrievalReport {
  const rows = queries.map((query) => scoreQuery(query, k));
  return {
    id,
    name,
    method: 'ranked-metrics',
    k,
    queryCount: queries.length,
    precisionAtK: mean(rows.map((row) => row.precision)),
    recallAtK: mean(rows.map((row) => row.recall)),
    mrr: mean(rows.map((row) => row.reciprocal)),
    ndcgAtK: mean(rows.map((row) => row.ndcg)),
    hitRate: mean(rows.map((row) => row.hit)),
  };
}

function scoreQuery(
  query: RankedQuery,
  k: number,
): { precision: number; recall: number; reciprocal: number; ndcg: number; hit: number } {
  const relevant = new Set(query.relevant);
  const ranked: string[] = [];
  for (const item of query.ranked) {
    if (!ranked.includes(item)) {
      ranked.push(item);
    }
    if (ranked.length === k) {
      break;
    }
  }
  const hits = ranked.filter((item) => relevant.has(item)).length;
  const first = ranked.findIndex((item) => relevant.has(item));
  const gains = ranked.map((item) => (relevant.has(item) ? 1 : 0));
  const ideal = Array.from({ length: Math.min(k, relevant.size) }, () => 1);
  const idealDcg = dcg(ideal);
  return {
    precision: k === 0 ? 0 : hits / k,
    recall: relevant.size === 0 ? 0 : hits / relevant.size,
    reciprocal: first === -1 ? 0 : 1 / (first + 1),
    ndcg: idealDcg === 0 ? 0 : dcg(gains) / idealDcg,
    hit: hits > 0 ? 1 : 0,
  };
}

function dcg(gains: readonly number[]): number {
  return gains.reduce((total, gain, index) => total + gain / Math.log2(index + 2), 0);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return round4(values.reduce((total, value) => total + value, 0) / values.length);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
