export interface RateCard {
  readonly sku: string;
  readonly hourlyUsd: number;
}

export interface UsageLine {
  readonly sku: string;
  readonly hours: number;
  readonly quantity: number;
}

export interface AdviceItem {
  readonly code: 'unknown_sku' | 'spend_spike' | 'idle' | 'dominant_cost';
  readonly sku: string;
  readonly message: string;
}

export interface CostReport {
  readonly id: string;
  readonly totalUsd: number;
  readonly lines: readonly { readonly sku: string; readonly usd: number }[];
  readonly advice: readonly AdviceItem[];
}

export function priceUsage(
  rates: ReadonlyMap<string, number>,
  lines: readonly UsageLine[],
  previous: ReadonlyMap<string, number>,
  id: string,
): CostReport {
  const priced: { sku: string; usd: number }[] = [];
  const advice: AdviceItem[] = [];
  for (const line of lines) {
    const rate = rates.get(line.sku);
    if (rate === undefined) {
      advice.push({
        code: 'unknown_sku',
        sku: line.sku,
        message: `No rate is configured for ${line.sku}.`,
      });
      continue;
    }
    const usd = round(line.hours * line.quantity * rate);
    priced.push({ sku: line.sku, usd });
    if (line.hours === 0 && line.quantity > 0) {
      advice.push({
        code: 'idle',
        sku: line.sku,
        message: `${line.sku} has quantity but zero hours.`,
      });
    }
    const before = previous.get(line.sku);
    if (before !== undefined && before >= 1 && usd >= before * 1.5 && usd - before >= 10) {
      advice.push({
        code: 'spend_spike',
        sku: line.sku,
        message: `${line.sku} spend rose from ${before.toFixed(2)} to ${usd.toFixed(2)} USD.`,
      });
    }
  }
  const totalUsd = round(priced.reduce((total, line) => total + line.usd, 0));
  const top = [...priced].sort((left, right) => right.usd - left.usd)[0];
  if (top !== undefined && totalUsd > 0 && top.usd / totalUsd >= 0.6) {
    advice.push({
      code: 'dominant_cost',
      sku: top.sku,
      message: `${top.sku} is at least 60% of this submission.`,
    });
  }
  return { id, totalUsd, lines: priced, advice };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
