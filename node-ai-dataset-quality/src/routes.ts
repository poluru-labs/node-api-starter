import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { isFieldType, profileDataset } from './quality.ts';
import type { FieldType, QualityReport } from './quality.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface DatasetStore {
  save(report: QualityReport): QualityReport;
  get(id: string): QualityReport | undefined;
}

export function createDatasetStore(): DatasetStore {
  const reports = new Map<string, QualityReport>();
  return {
    save(report) {
      if (reports.size >= storeLimit && !reports.has(report.id)) {
        const oldest = reports.keys().next().value;
        if (oldest !== undefined) {
          reports.delete(oldest);
        }
      }
      reports.set(report.id, report);
      return report;
    },
    get(id) {
      return reports.get(id);
    },
  };
}

export function createRoutes(store: DatasetStore = createDatasetStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Dataset quality is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/datasets',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseDataset(body);
        if (parsed === undefined) {
          if (!ctx.response.headersSent) {
            ctx.sendJson(400, { error: 'invalid_body' });
          }
          return;
        }
        ctx.sendJson(
          201,
          store.save(profileDataset(parsed.name, parsed.rows, parsed.schema, randomUUID())),
        );
      },
    },
    {
      method: 'GET',
      path: '/v1/datasets/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-dataset-quality.json')),
  ];
}

function parseDataset(body: unknown):
  | {
      name: string;
      rows: Record<string, unknown>[];
      schema: Record<string, FieldType>;
    }
  | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || body['name'].trim().length === 0) {
    return undefined;
  }
  if (body['name'].trim().length > 120 || !Array.isArray(body['rows'])) {
    return undefined;
  }
  if (body['rows'].length === 0 || body['rows'].length > 500) {
    return undefined;
  }
  const rows: Record<string, unknown>[] = [];
  for (const row of body['rows']) {
    if (!isRecord(row) || Object.keys(row).length > 50) {
      return undefined;
    }
    rows.push(row);
  }
  const schema = parseSchema(body['schema']);
  if (schema === undefined) {
    return undefined;
  }
  return { name: body['name'].trim(), rows, schema };
}

function parseSchema(value: unknown): Record<string, FieldType> | undefined {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const schema: Record<string, FieldType> = {};
  for (const [key, kind] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key) || !isFieldType(kind)) {
      return undefined;
    }
    schema[key] = kind;
  }
  return schema;
}
