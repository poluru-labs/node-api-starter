export interface BenchSample {
  readonly latencyMs: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly success: boolean;
}

export interface BenchSlo {
  readonly maxP95Ms: number;
  readonly minSuccessRate: number;
}

export interface BenchFlag {
  readonly code: 'latency_slo' | 'reliability';
  readonly message: string;
}

export interface BenchReport {
  readonly id: string;
  readonly model: string;
  readonly method: 'percentile-summary';
  readonly count: number;
  readonly successRate: number;
  readonly meanLatencyMs: number | null;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
  readonly tokensPerSecond: number | null;
  readonly ok: boolean;
  readonly flags: readonly BenchFlag[];
}

export function summarizeBenchmark(
  model: string,
  samples: readonly BenchSample[],
  slo: BenchSlo,
  id: string,
): BenchReport {
  const successes = samples.filter((sample) => sample.success);
  const latencies = successes.map((sample) => sample.latencyMs).sort((left, right) => left - right);
  const successRate = samples.length === 0 ? 0 : round4(successes.length / samples.length);
  const latencyTotal = successes.reduce((total, sample) => total + sample.latencyMs, 0);
  const tokenTotal = successes.reduce((total, sample) => total + sample.tokensOut, 0);
  const p95 = latencies.length === 0 ? null : round2(quantile(latencies, 0.95));
  const flags: BenchFlag[] = [];
  if (p95 !== null && p95 > slo.maxP95Ms) {
    flags.push({
      code: 'latency_slo',
      message: 'p95 latency is above the service level objective.',
    });
  }
  if (successRate < slo.minSuccessRate) {
    flags.push({
      code: 'reliability',
      message: 'The success rate is below the service level objective.',
    });
  }
  return {
    id,
    model,
    method: 'percentile-summary',
    count: samples.length,
    successRate,
    meanLatencyMs: latencies.length === 0 ? null : round2(latencyTotal / latencies.length),
    p50Ms: latencies.length === 0 ? null : round2(quantile(latencies, 0.5)),
    p95Ms: p95,
    p99Ms: latencies.length === 0 ? null : round2(quantile(latencies, 0.99)),
    tokensPerSecond: latencyTotal === 0 ? null : round2(tokenTotal / (latencyTotal / 1000)),
    ok: flags.length === 0,
    flags,
  };
}

function quantile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const left = sorted[lower] ?? 0;
  const right = sorted[upper] ?? left;
  if (lower === upper) {
    return left;
  }
  return left + (right - left) * (position - lower);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
