import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { summarizeBenchmark } from './benchmarks.ts';
import type { BenchReport, BenchSample, BenchSlo } from './benchmarks.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface BenchmarkStore {
  save(report: BenchReport): BenchReport;
  get(id: string): BenchReport | undefined;
}

export function createBenchmarkStore(): BenchmarkStore {
  const reports = new Map<string, BenchReport>();
  return {
    save(report) {
      remember(reports, report.id, report, storeLimit);
      return report;
    },
    get(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: BenchmarkStore = createBenchmarkStore()): readonly Route[] {
  return [
    root('Inference benchmarks is running.'),
    {
      method: 'POST',
      path: '/v1/benchmarks',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseBenchmark(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(summarizeBenchmark(parsed.model, parsed.samples, parsed.slo, randomUUID())),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/benchmarks/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-inference-benchmarks.json')),
  ];
}

function parseBenchmark(
  body: unknown,
): { model: string; samples: BenchSample[]; slo: BenchSlo } | undefined {
  if (
    !isRecord(body) ||
    typeof body['model'] !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(body['model'])
  ) {
    return undefined;
  }
  if (
    !Array.isArray(body['samples']) ||
    body['samples'].length === 0 ||
    body['samples'].length > 1_000
  ) {
    return undefined;
  }
  const samples: BenchSample[] = [];
  for (const entry of body['samples']) {
    const sample = parseSample(entry);
    if (sample === undefined) {
      return undefined;
    }
    samples.push(sample);
  }
  const slo = parseSlo(body['slo']);
  if (slo === undefined) {
    return undefined;
  }
  return { model: body['model'], samples, slo };
}

function parseSample(value: unknown): BenchSample | undefined {
  if (!isRecord(value) || typeof value['success'] !== 'boolean') {
    return undefined;
  }
  const latencyMs = numberIn(value['latencyMs'], 0, 600_000);
  const tokensIn = integerIn(value['tokensIn'], 0, 1_000_000);
  const tokensOut = integerIn(value['tokensOut'], 0, 1_000_000);
  if (latencyMs === undefined || tokensIn === undefined || tokensOut === undefined) {
    return undefined;
  }
  return { latencyMs, tokensIn, tokensOut, success: value['success'] };
}

function parseSlo(value: unknown): BenchSlo | undefined {
  if (value === undefined) {
    return { maxP95Ms: 500, minSuccessRate: 0.99 };
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const maxP95Ms = value['maxP95Ms'] === undefined ? 500 : integerIn(value['maxP95Ms'], 1, 600_000);
  const minSuccessRate =
    value['minSuccessRate'] === undefined ? 0.99 : numberIn(value['minSuccessRate'], 0, 1);
  if (maxP95Ms === undefined || minSuccessRate === undefined) {
    return undefined;
  }
  return { maxP95Ms, minSuccessRate };
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return undefined;
  }
  return value;
}

function integerIn(value: unknown, min: number, max: number): number | undefined {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < min || value > max) {
    return undefined;
  }
  return value;
}

function root(message: string): Route {
  return {
    method: 'GET',
    path: '/',
    handler(ctx) {
      ctx.sendJson(200, { service: ctx.config.serviceName, message });
    },
  };
}

function remember<T>(items: Map<string, T>, id: string, value: T, limit: number): void {
  if (items.size >= limit && !items.has(id)) {
    const oldest = items.keys().next().value;
    if (oldest !== undefined) {
      items.delete(oldest);
    }
  }
  items.set(id, value);
}
