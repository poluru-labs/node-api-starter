export interface WasteRecord {
  readonly day: string;
  readonly item: string;
  readonly prepared: number;
  readonly sold: number;
  readonly wasted: number;
}

export interface ItemPlan {
  readonly item: string;
  readonly days: number;
  readonly wasteRate: number;
  readonly stockoutRate: number;
  readonly recommend: number;
  readonly advice: 'reduce' | 'increase' | 'hold';
}

export interface WasteReport {
  readonly id: string;
  readonly name: string;
  readonly method: 'trailing-mean';
  readonly items: readonly ItemPlan[];
}

export function planWaste(name: string, records: readonly WasteRecord[], id: string): WasteReport {
  const grouped = new Map<string, WasteRecord[]>();
  for (const record of records) {
    const bucket = grouped.get(record.item) ?? [];
    bucket.push(record);
    grouped.set(record.item, bucket);
  }

  const items = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([item, history]) => planItem(item, history));

  return { id, name, method: 'trailing-mean', items };
}

function planItem(item: string, records: readonly WasteRecord[]): ItemPlan {
  const ordered = [...records].sort((left, right) => left.day.localeCompare(right.day));
  const recent = ordered.slice(-7);
  let prepared = 0;
  let wasted = 0;
  let stockouts = 0;
  for (const record of ordered) {
    prepared += record.prepared;
    wasted += record.wasted;
    if (record.prepared > 0 && record.sold >= record.prepared && record.wasted === 0) {
      stockouts += 1;
    }
  }
  const sold = recent.reduce((total, record) => total + record.sold, 0);
  const wasteRate = prepared === 0 ? 0 : round3(wasted / prepared);
  const stockoutRate = ordered.length === 0 ? 0 : round3(stockouts / ordered.length);
  const recommend = recent.length === 0 ? 0 : Math.ceil((sold * 11) / (recent.length * 10));
  let advice: ItemPlan['advice'] = 'hold';
  if (wasteRate > 0.2) {
    advice = 'reduce';
  } else if (stockoutRate >= 0.3) {
    advice = 'increase';
  }
  return { item, days: ordered.length, wasteRate, stockoutRate, recommend, advice };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
