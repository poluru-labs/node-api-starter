import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { summarizeImpact } from './impact.ts';
import type { Activity, Program } from './impact.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface ProgramStore {
  save(program: Program): Program;
  get(id: string): Program | undefined;
}

export function createProgramStore(): ProgramStore {
  const programs = new Map<string, Program>();
  return {
    save(program) {
      remember(programs, program.id, program, storeLimit);
      return program;
    },
    get(id) {
      return programs.get(id);
    },
  };
}

export function createRoutes(store: ProgramStore = createProgramStore()): readonly Route[] {
  return [
    root('Nonprofit impact is running.'),
    {
      method: 'POST',
      path: '/v1/programs',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseProgram(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed, activities: [] }));
      },
    },
    {
      method: 'POST',
      path: '/v1/programs/:id/activities',
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
        const activity = parseActivity(body);
        if (activity === undefined || current.activities.length >= 100) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        const saved = store.save({ ...current, activities: [...current.activities, activity] });
        ctx.sendJson(201, { activity, impact: summarizeImpact(saved) });
      },
    },
    {
      method: 'GET',
      path: '/v1/programs/:id',
      handler(ctx) {
        const program = store.get(ctx.params['id'] ?? '');
        if (program === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, { ...program, impact: summarizeImpact(program) });
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-nonprofit-impact.json')),
  ];
}

function parseProgram(body: unknown): Pick<Program, 'name' | 'mission'> | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const name = text(body['name'], 80);
  const mission = text(body['mission'], 240);
  if (name === undefined || mission === undefined) {
    return undefined;
  }
  return { name, mission };
}

function parseActivity(body: unknown): Activity | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const name = text(body['name'], 80);
  const output = text(body['output'], 240);
  const period = text(body['period'], 20);
  if (name === undefined || output === undefined || period === undefined) {
    return undefined;
  }
  const beneficiaries = body['beneficiaries'];
  const costUsd = body['costUsd'];
  if (
    typeof beneficiaries !== 'number' ||
    !Number.isInteger(beneficiaries) ||
    beneficiaries < 0 ||
    beneficiaries > 10_000_000 ||
    typeof costUsd !== 'number' ||
    !Number.isFinite(costUsd) ||
    costUsd < 0 ||
    costUsd > 1e12
  ) {
    return undefined;
  }
  const outcome =
    body['outcome'] === undefined || body['outcome'] === null ? null : text(body['outcome'], 240);
  if (outcome === undefined) {
    return undefined;
  }
  return { id: randomUUID(), name, output, outcome, beneficiaries, costUsd, period };
}

function text(value: unknown, max: number): string | undefined {
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
