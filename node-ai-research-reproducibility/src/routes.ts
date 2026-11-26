import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { assessStudy, isEnvironmentPin } from './studies.ts';
import type { Study, StudyInput } from './studies.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface StudyStore {
  save(study: Study): Study;
  get(id: string): Study | undefined;
}

export function createStudyStore(): StudyStore {
  const studies = new Map<string, Study>();
  return {
    save(study) {
      remember(studies, study.id, study, storeLimit);
      return study;
    },
    get(id) {
      return studies.get(id);
    },
  };
}

export function createRoutes(store: StudyStore = createStudyStore()): readonly Route[] {
  return [
    root('Research reproducibility is running.'),
    {
      method: 'POST',
      path: '/v1/studies',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseStudy(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(assessStudy(parsed, randomUUID())));
      },
    },
    {
      method: 'GET',
      path: '/v1/studies/:id',
      handler(ctx) {
        const study = store.get(ctx.params['id'] ?? '');
        if (study === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, study);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-research-reproducibility.json')),
  ];
}

function parseStudy(body: unknown): StudyInput | undefined {
  if (
    !isRecord(body) ||
    typeof body['title'] !== 'string' ||
    !isEnvironmentPin(body['environment'])
  ) {
    return undefined;
  }
  const title = body['title'].trim();
  if (title.length === 0 || title.length > 160) {
    return undefined;
  }
  const data = flag(body['data']);
  const code = flag(body['code']);
  const seed = flag(body['seed']);
  const command = flag(body['command']);
  const hardware = flag(body['hardware']);
  const license = flag(body['license']);
  if (
    data === undefined ||
    code === undefined ||
    seed === undefined ||
    command === undefined ||
    hardware === undefined ||
    license === undefined
  ) {
    return undefined;
  }
  return { title, data, code, environment: body['environment'], seed, command, hardware, license };
}

function flag(value: unknown): boolean | undefined {
  if (typeof value !== 'boolean') {
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
