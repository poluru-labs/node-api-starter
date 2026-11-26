import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { priceUsage } from './cost.ts';
import type { CostReport, UsageLine } from './cost.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly rates: ReadonlyMap<string, number>;
  readonly previous: ReadonlyMap<string, number>;
  readonly latest: CostReport | null;
}

export interface CostStore {
  save(account: Account): Account;
  get(id: string): Account | undefined;
}

export function createCostStore(): CostStore {
  const accounts = new Map<string, Account>();
  return {
    save(account) {
      accounts.set(account.id, account);
      return account;
    },
    get(id) {
      return accounts.get(id);
    },
  };
}

export function createRoutes(store: CostStore = createCostStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Cloud cost advisor is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/accounts',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseAccount(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const account = store.save({
          id: randomUUID(),
          name: parsed.name,
          rates: parsed.rates,
          previous: new Map(),
          latest: null,
        });
        ctx.sendJson(201, { id: account.id, name: account.name, skus: [...account.rates.keys()] });
      },
    },
    {
      method: 'POST',
      path: '/v1/accounts/:id/usage',
      async handler(ctx) {
        const current = store.get(ctx.params['id'] ?? '');
        if (current === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const lines = isRecord(body) ? parseLines(body['items']) : undefined;
        if (lines === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const report = priceUsage(current.rates, lines, current.previous, randomUUID());
        const previous = new Map(current.previous);
        for (const line of report.lines) {
          previous.set(line.sku, line.usd);
        }
        store.save({ ...current, previous, latest: report });
        ctx.sendJson(201, report);
      },
    },
    {
      method: 'GET',
      path: '/v1/accounts/:id',
      handler(ctx) {
        const account = store.get(ctx.params['id'] ?? '');
        if (account === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, {
          id: account.id,
          name: account.name,
          skus: [...account.rates.keys()],
          latest: account.latest,
        });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-cloud-cost-advisor.json')),
  ];
}

function parseAccount(body: unknown): { name: string; rates: Map<string, number> } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || body['name'].trim().length === 0) {
    return undefined;
  }
  if (!isRecord(body['rates'])) {
    return undefined;
  }
  const rates = new Map<string, number>();
  for (const [sku, price] of Object.entries(body['rates'])) {
    if (
      !/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(sku) ||
      typeof price !== 'number' ||
      price < 0 ||
      !Number.isFinite(price)
    ) {
      return undefined;
    }
    rates.set(sku, price);
  }
  if (rates.size === 0 || body['name'].trim().length > 80) {
    return undefined;
  }
  return { name: body['name'].trim(), rates };
}

function parseLines(value: unknown): UsageLine[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
    return undefined;
  }
  const lines: UsageLine[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item['sku'] !== 'string' || typeof item['hours'] !== 'number') {
      return undefined;
    }
    if (!Number.isFinite(item['hours']) || item['hours'] < 0) {
      return undefined;
    }
    const quantity = item['quantity'] === undefined ? 1 : item['quantity'];
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
      return undefined;
    }
    lines.push({ sku: item['sku'], hours: item['hours'], quantity });
  }
  return lines;
}
