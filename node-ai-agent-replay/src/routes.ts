import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { compareSteps, parseSteps } from './replay.ts';
import type { ReplayComparison, ReplayStep } from './replay.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface ReplaySession {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly ReplayStep[];
  readonly comparison: ReplayComparison | null;
}

export interface ReplayStore {
  save(session: ReplaySession): ReplaySession;
  get(id: string): ReplaySession | undefined;
}

export function createReplayStore(): ReplayStore {
  const sessions = new Map<string, ReplaySession>();
  return {
    save(session) {
      if (sessions.size >= storeLimit && !sessions.has(session.id)) {
        const oldest = sessions.keys().next().value;
        if (oldest !== undefined) {
          sessions.delete(oldest);
        }
      }
      sessions.set(session.id, session);
      return session;
    },
    get(id) {
      return sessions.get(id);
    },
  };
}

export function createRoutes(store: ReplayStore = createReplayStore()): readonly Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler(ctx) {
        ctx.sendJson(200, {
          service: ctx.config.serviceName,
          message: 'Agent replay is running.',
        });
      },
    },
    {
      method: 'POST',
      path: '/v1/replays',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const session = parseSession(body);
        if (session === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...session, comparison: null }));
      },
    },
    {
      method: 'POST',
      path: '/v1/replays/:id/comparisons',
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
        if (!isRecord(body)) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const steps = parseSteps(body['steps']);
        if (steps === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const comparison = compareSteps(current.steps, steps);
        ctx.sendJson(200, store.save({ ...current, comparison }));
      },
    },
    {
      method: 'GET',
      path: '/v1/replays/:id',
      handler(ctx) {
        const session = store.get(ctx.params['id'] ?? '');
        if (session === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, session);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-agent-replay.json')),
  ];
}

function parseSession(body: unknown): { name: string; steps: ReplayStep[] } | undefined {
  if (!isRecord(body) || typeof body['name'] !== 'string' || body['name'].trim() === '') {
    return undefined;
  }
  if (body['name'].trim().length > 120) {
    return undefined;
  }
  const steps = parseSteps(body['steps']);
  if (steps === undefined) {
    return undefined;
  }
  return { name: body['name'].trim(), steps };
}
