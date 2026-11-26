import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import { guide, isBulletinSeverity, isCertainty, isDisasterEvent, isUrgency } from './bulletins.ts';
import type { Bulletin, DisasterEvent } from './bulletins.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 500;

export interface BulletinStore {
  save(bulletin: Bulletin): Bulletin;
  get(id: string): Bulletin | undefined;
  list(): readonly Bulletin[];
}

export function createBulletinStore(): BulletinStore {
  const bulletins = new Map<string, Bulletin>();
  return {
    save(bulletin) {
      remember(bulletins, bulletin.id, bulletin, storeLimit);
      return bulletin;
    },
    get(id) {
      return bulletins.get(id);
    },
    list() {
      return [...bulletins.values()];
    },
  };
}

export function createRoutes(store: BulletinStore = createBulletinStore()): readonly Route[] {
  return [
    root('Disaster information is running.'),
    {
      method: 'POST',
      path: '/v1/bulletins',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseBulletin(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save({ id: randomUUID(), ...parsed }));
      },
    },
    {
      method: 'GET',
      path: '/v1/bulletins/:id',
      handler(ctx) {
        const bulletin = store.get(ctx.params['id'] ?? '');
        if (bulletin === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, bulletin);
      },
    },
    {
      method: 'POST',
      path: '/v1/guidance',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseGuidance(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(200, guide(store.list(), parsed.area, parsed.event, parsed.at));
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-disaster-information.json')),
  ];
}

function parseBulletin(body: unknown): Omit<Bulletin, 'id'> | undefined {
  if (!isRecord(body) || !isDisasterEvent(body['event']) || !isBulletinSeverity(body['severity'])) {
    return undefined;
  }
  const urgency = body['urgency'] === undefined ? 'expected' : body['urgency'];
  const certainty = body['certainty'] === undefined ? 'likely' : body['certainty'];
  if (!isUrgency(urgency) || !isCertainty(certainty)) {
    return undefined;
  }
  const area = text(body['area'], 40);
  const headline = text(body['headline'], 160);
  const instruction = text(body['instruction'], 500);
  const expiresAt = instant(body['expiresAt']);
  const issuedAt =
    body['issuedAt'] === undefined ? new Date().toISOString() : instant(body['issuedAt']);
  if (
    area === undefined ||
    headline === undefined ||
    instruction === undefined ||
    expiresAt === undefined ||
    issuedAt === undefined ||
    Date.parse(expiresAt) <= Date.parse(issuedAt)
  ) {
    return undefined;
  }
  return {
    event: body['event'],
    severity: body['severity'],
    urgency,
    certainty,
    area: area.toLowerCase(),
    headline,
    instruction,
    issuedAt,
    expiresAt,
  };
}

function parseGuidance(
  body: unknown,
): { area: string; event: DisasterEvent | null; at: string } | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const area = text(body['area'], 40);
  const at = instant(body['at']);
  if (area === undefined || at === undefined) {
    return undefined;
  }
  if (body['event'] === undefined || body['event'] === null) {
    return { area: area.toLowerCase(), event: null, at };
  }
  if (!isDisasterEvent(body['event'])) {
    return undefined;
  }
  return { area: area.toLowerCase(), event: body['event'], at };
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

function instant(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return undefined;
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return undefined;
  }
  return new Date(time).toISOString();
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
