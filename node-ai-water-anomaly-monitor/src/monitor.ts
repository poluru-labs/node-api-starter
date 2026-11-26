export const waterMetrics = ['flow', 'turbidity', 'level'] as const;
export type WaterMetric = (typeof waterMetrics)[number];

export interface WaterPoint {
  readonly at: string;
  readonly value: number;
}

export interface WaterAnomaly {
  readonly at: string;
  readonly code: 'negative' | 'spike' | 'flatline' | 'threshold';
  readonly message: string;
}

export interface WaterMonitor {
  readonly id: string;
  readonly name: string;
  readonly metric: WaterMetric;
  readonly unit: string;
  readonly threshold: number | null;
}

export interface ReadingReport {
  readonly monitorId: string;
  readonly method: 'rule-and-change';
  readonly pointCount: number;
  readonly anomalies: readonly WaterAnomaly[];
}

export function isWaterMetric(value: unknown): value is WaterMetric {
  return typeof value === 'string' && waterMetrics.some((metric) => metric === value);
}

export function inspectReadings(
  monitor: WaterMonitor,
  points: readonly WaterPoint[],
): ReadingReport {
  const ordered = [...points].sort((left, right) => left.at.localeCompare(right.at));
  const anomalies: WaterAnomaly[] = [];
  ordered.forEach((point, index) => {
    if (point.value < 0) {
      anomalies.push({ at: point.at, code: 'negative', message: 'The reading is below zero.' });
    }
    if (
      monitor.metric === 'turbidity' &&
      monitor.threshold !== null &&
      point.value > monitor.threshold
    ) {
      anomalies.push({
        at: point.at,
        code: 'threshold',
        message: 'Turbidity is above the configured threshold.',
      });
    }
    const previous = ordered[index - 1];
    if (
      previous !== undefined &&
      previous.value > 0 &&
      point.value >= previous.value * 3 &&
      point.value - previous.value >= 1
    ) {
      anomalies.push({
        at: point.at,
        code: 'spike',
        message: 'The reading jumped to at least three times the previous value.',
      });
    }
    if (index >= 3) {
      const window = ordered.slice(index - 3, index + 1);
      if (window.every((item) => item.value === point.value)) {
        anomalies.push({
          at: point.at,
          code: 'flatline',
          message: 'Four readings in a row are identical.',
        });
      }
    }
  });
  return {
    monitorId: monitor.id,
    method: 'rule-and-change',
    pointCount: ordered.length,
    anomalies,
  };
}
