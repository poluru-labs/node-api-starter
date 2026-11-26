import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { checkDocument, isBlockType } from './document.ts';
import type { DocumentBlock, DocumentModel, DocumentPage, DocumentReport } from './document.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface DocumentStore {
  save(report: DocumentReport): DocumentReport;
  get(id: string): DocumentReport | undefined;
}

export function createDocumentStore(): DocumentStore {
  const reports = new Map<string, DocumentReport>();
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

export function createRoutes(store: DocumentStore = createDocumentStore()): readonly Route[] {
  return [
    root('Document accessibility is running.'),
    {
      method: 'POST',
      path: '/v1/documents',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const document = parseDocument(body);
        if (document === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(checkDocument(document, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/documents/:id',
      handler(ctx) {
        const report = store.get(ctx.params['id'] ?? '');
        if (report === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, report);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-document-accessibility.json')),
  ];
}

function parseDocument(body: unknown): DocumentModel | undefined {
  if (
    !isRecord(body) ||
    !Array.isArray(body['pages']) ||
    body['pages'].length === 0 ||
    body['pages'].length > 30
  ) {
    return undefined;
  }
  const title = optionalText(body['title'], 200);
  const language = optionalText(body['language'], 16);
  if (!title.ok || !language.ok) {
    return undefined;
  }
  const pages: DocumentPage[] = [];
  for (const entry of body['pages']) {
    const page = parsePage(entry);
    if (page === undefined) {
      return undefined;
    }
    pages.push(page);
  }
  return { title: title.value, language: language.value, pages };
}

function parsePage(value: unknown): DocumentPage | undefined {
  if (!isRecord(value) || !Array.isArray(value['blocks']) || value['blocks'].length > 80) {
    return undefined;
  }
  if (
    typeof value['number'] !== 'number' ||
    !Number.isInteger(value['number']) ||
    value['number'] < 1
  ) {
    return undefined;
  }
  const blocks: DocumentBlock[] = [];
  for (const entry of value['blocks']) {
    const block = parseBlock(entry);
    if (block === undefined) {
      return undefined;
    }
    blocks.push(block);
  }
  return { number: value['number'], blocks };
}

function parseBlock(value: unknown): DocumentBlock | undefined {
  if (!isRecord(value) || !isBlockType(value['type'])) {
    return undefined;
  }
  const text = optionalText(value['text'], 5_000);
  const alt = optionalText(value['alt'], 300);
  const href = optionalText(value['href'], 300);
  if (!text.ok || !alt.ok || !href.ok) {
    return undefined;
  }
  const level = value['level'];
  if (
    level !== undefined &&
    level !== null &&
    (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6)
  ) {
    return undefined;
  }
  const hasHeader = value['hasHeader'];
  if (hasHeader !== undefined && hasHeader !== null && typeof hasHeader !== 'boolean') {
    return undefined;
  }
  return {
    type: value['type'],
    text: text.value,
    level: typeof level === 'number' ? level : null,
    alt: alt.value,
    hasHeader: typeof hasHeader === 'boolean' ? hasHeader : null,
    href: href.value,
  };
}

function optionalText(
  value: unknown,
  max: number,
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string' || value.length > max) {
    return { ok: false };
  }
  return { ok: true, value };
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
