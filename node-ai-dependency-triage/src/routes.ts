import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isFailOn, isSeverity, triageDependencies } from './triage.ts';
import type { Advisory, Dependency, FailOn, TriageReport } from './triage.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface TriageStore {
  save(report: TriageReport): TriageReport;
  get(id: string): TriageReport | undefined;
}

export function createTriageStore(): TriageStore {
  const reports = new Map<string, TriageReport>();
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

export function createRoutes(store: TriageStore = createTriageStore()): readonly Route[] {
  return [
    root('Dependency triage is running.'),
    {
      method: 'POST',
      path: '/v1/reports',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseReport(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const report = store.save(
          triageDependencies(
            parsed.ecosystem,
            parsed.failOn,
            parsed.allowedLicenses,
            parsed.dependencies,
            randomUUID(),
          ),
        );
        ctx.sendJson(201, report);
      },
    },
    {
      method: 'GET',
      path: '/v1/reports/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-dependency-triage.json')),
  ];
}

function parseReport(body: unknown):
  | {
      ecosystem: string;
      failOn: FailOn;
      allowedLicenses: string[] | null;
      dependencies: Dependency[];
    }
  | undefined {
  if (
    !isRecord(body) ||
    !Array.isArray(body['dependencies']) ||
    body['dependencies'].length === 0
  ) {
    return undefined;
  }
  if (body['dependencies'].length > 200) {
    return undefined;
  }
  const ecosystem = body['ecosystem'] === undefined ? 'npm' : body['ecosystem'];
  if (typeof ecosystem !== 'string' || !/^[a-z][a-z0-9-]{0,20}$/.test(ecosystem)) {
    return undefined;
  }
  const failOn = body['failOn'] === undefined ? 'high' : body['failOn'];
  if (!isFailOn(failOn)) {
    return undefined;
  }
  const allowedLicenses = parseLicenses(body['allowedLicenses']);
  if (allowedLicenses === 'invalid') {
    return undefined;
  }
  const dependencies: Dependency[] = [];
  for (const entry of body['dependencies']) {
    const dependency = parseDependency(entry);
    if (dependency === undefined) {
      return undefined;
    }
    dependencies.push(dependency);
  }
  return { ecosystem, failOn, allowedLicenses, dependencies };
}

function parseLicenses(value: unknown): string[] | null | 'invalid' {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    return 'invalid';
  }
  const licenses: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0 || entry.trim().length > 40) {
      return 'invalid';
    }
    licenses.push(entry.trim());
  }
  return licenses;
}

function parseDependency(value: unknown): Dependency | undefined {
  if (
    !isRecord(value) ||
    typeof value['name'] !== 'string' ||
    typeof value['version'] !== 'string'
  ) {
    return undefined;
  }
  if (
    !/^[@A-Za-z0-9/_.-]{1,120}$/.test(value['name']) ||
    !/^[A-Za-z0-9.+_-]{1,40}$/.test(value['version'])
  ) {
    return undefined;
  }
  const direct = value['direct'] === undefined ? false : value['direct'];
  if (typeof direct !== 'boolean') {
    return undefined;
  }
  const license = value['license'] ?? null;
  if (
    license !== null &&
    (typeof license !== 'string' || license.trim().length === 0 || license.length > 40)
  ) {
    return undefined;
  }
  const deprecated = value['deprecated'] === undefined ? false : value['deprecated'];
  if (typeof deprecated !== 'boolean') {
    return undefined;
  }
  const latest = value['latest'] ?? null;
  if (latest !== null && (typeof latest !== 'string' || !/^[A-Za-z0-9.+_-]{1,40}$/.test(latest))) {
    return undefined;
  }
  const advisories = parseAdvisories(value['advisories']);
  if (advisories === undefined) {
    return undefined;
  }
  return {
    name: value['name'],
    version: value['version'],
    direct,
    license: license === null ? null : license.trim(),
    deprecated,
    latest,
    advisories,
  };
}

function parseAdvisories(value: unknown): Advisory[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 20) {
    return undefined;
  }
  const advisories: Advisory[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      !/^[A-Za-z0-9:_-]{1,40}$/.test(entry['id'])
    ) {
      return undefined;
    }
    if (!isSeverity(entry['severity']) || entry['severity'] === 'none') {
      return undefined;
    }
    advisories.push({ id: entry['id'], severity: entry['severity'] });
  }
  return advisories;
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
