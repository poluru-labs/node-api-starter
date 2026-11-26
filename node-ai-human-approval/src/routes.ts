import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { applyDecision, isApprovalStatus, isRiskLevel, openRequest } from './approvals.ts';
import type { ApprovalRequest, ApprovalStatus } from './approvals.ts';
import { isRecord, readJsonBody } from './body.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface ApprovalStore {
  save(request: ApprovalRequest): ApprovalRequest;
  get(id: string): ApprovalRequest | undefined;
  list(status: ApprovalStatus | null): readonly ApprovalRequest[];
}

export function createApprovalStore(): ApprovalStore {
  const requests = new Map<string, ApprovalRequest>();
  return {
    save(request) {
      remember(requests, request.id, request, storeLimit);
      return request;
    },
    get(id) {
      return requests.get(id);
    },
    list(status) {
      const all = [...requests.values()].reverse();
      const filtered = status === null ? all : all.filter((request) => request.status === status);
      return filtered.slice(0, 50);
    },
  };
}

export function createRoutes(store: ApprovalStore = createApprovalStore()): readonly Route[] {
  return [
    root('Human approval is running.'),
    {
      method: 'POST',
      path: '/v1/requests',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseRequest(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const createdAt = new Date().toISOString();
        ctx.sendJson(201, store.save(openRequest(parsed, randomUUID(), createdAt)));
      },
    },
    {
      method: 'GET',
      path: '/v1/requests',
      handler(ctx) {
        const status = ctx.url.searchParams.get('status');
        if (status === null) {
          ctx.sendJson(200, { requests: store.list(null) });
          return;
        }
        if (!isApprovalStatus(status)) {
          ctx.sendJson(400, { error: 'invalid_query' });
          return;
        }
        ctx.sendJson(200, { requests: store.list(status) });
      },
    },
    {
      method: 'GET',
      path: '/v1/requests/:id',
      handler(ctx) {
        const request = store.get(ctx.params['id'] ?? '');
        if (request === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, request);
      },
    },
    {
      method: 'POST',
      path: '/v1/requests/:id/decisions',
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
        const parsed = parseDecision(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const result = applyDecision(
          current,
          parsed.reviewer,
          parsed.decision,
          parsed.reason,
          new Date().toISOString(),
        );
        if (!result.ok) {
          ctx.sendJson(result.error === 'already_decided' ? 409 : 400, { error: result.error });
          return;
        }
        ctx.sendJson(200, store.save(result.request));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-human-approval.json')),
  ];
}

function parseRequest(body: unknown):
  | {
      actor: string;
      action: string;
      summary: string;
      risk: ApprovalRequest['risk'];
      payload: unknown;
    }
  | undefined {
  if (!isRecord(body) || !isRiskLevel(body['risk'])) {
    return undefined;
  }
  const actor = shortText(body['actor'], 80);
  const action = shortText(body['action'], 80);
  const summary = shortText(body['summary'], 240);
  if (actor === undefined || action === undefined || summary === undefined) {
    return undefined;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(action)) {
    return undefined;
  }
  const payload = body['payload'] === undefined ? {} : body['payload'];
  if (!isRecord(payload) || JSON.stringify(payload).length > 8_000) {
    return undefined;
  }
  return { actor, action, summary, risk: body['risk'], payload };
}

function parseDecision(
  body: unknown,
): { reviewer: string; decision: 'approve' | 'reject'; reason: string } | undefined {
  if (!isRecord(body) || (body['decision'] !== 'approve' && body['decision'] !== 'reject')) {
    return undefined;
  }
  const reviewer = shortText(body['reviewer'], 80);
  if (reviewer === undefined || reviewer.toLowerCase() === 'policy') {
    return undefined;
  }
  const reason = body['reason'] === undefined ? '' : body['reason'];
  if (typeof reason !== 'string' || reason.length > 500) {
    return undefined;
  }
  return { reviewer, decision: body['decision'], reason };
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    return undefined;
  }
  return trimmed;
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
