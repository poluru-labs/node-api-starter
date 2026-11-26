import { randomUUID } from 'node:crypto';
import type { Route } from './app.ts';
import { isRecord, readJsonBody } from './body.ts';
import {
  addEvent,
  isEventKind,
  isIncidentSeverity,
  isIncidentStatus,
  openIncident,
  withStatus,
} from './incidents.ts';
import type { EventKind, Incident, IncidentEvent } from './incidents.ts';
import { createMockRoutes, loadMockSpec } from './mock-api.ts';

const storeLimit = 200;

export interface IncidentStore {
  save(incident: Incident): Incident;
  get(id: string): Incident | undefined;
}

export function createIncidentStore(): IncidentStore {
  const incidents = new Map<string, Incident>();
  return {
    save(incident) {
      remember(incidents, incident.id, incident, storeLimit);
      return incident;
    },
    get(id) {
      return incidents.get(id);
    },
  };
}

export function createRoutes(store: IncidentStore = createIncidentStore()): readonly Route[] {
  return [
    root('Incident investigator is running.'),
    {
      method: 'POST',
      path: '/v1/incidents',
      async handler(ctx) {
        const body = await readJsonBody(ctx.request, (status, payload) => {
          ctx.sendJson(status, payload);
        });
        if (body === undefined) {
          return;
        }
        const parsed = parseIncident(body);
        if (parsed === undefined) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(
          201,
          store.save(
            openIncident(
              parsed.title,
              parsed.severity,
              parsed.service,
              randomUUID(),
              new Date().toISOString(),
            ),
          ),
        );
      },
    },
    {
      method: 'POST',
      path: '/v1/incidents/:id/events',
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
        const parsed = parseEvent(body, current.events.length);
        if (parsed === undefined || current.events.length >= 100) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(201, store.save(addEvent(current, parsed)));
      },
    },
    {
      method: 'POST',
      path: '/v1/incidents/:id/status',
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
        if (!isRecord(body) || !isIncidentStatus(body['status'])) {
          ctx.sendJson(400, { error: 'invalid_body' });
          return;
        }
        ctx.sendJson(200, store.save(withStatus(current, body['status'])));
      },
    },
    {
      method: 'GET',
      path: '/v1/incidents/:id',
      handler(ctx) {
        const incident = store.get(ctx.params['id'] ?? '');
        if (incident === undefined) {
          ctx.sendJson(404, { error: 'not_found' });
          return;
        }
        ctx.sendJson(200, incident);
      },
    },
    ...createMockRoutes(loadMockSpec('node-ai-incident-investigator.json')),
  ];
}

function parseIncident(
  body: unknown,
): { title: string; severity: Incident['severity']; service: string } | undefined {
  if (!isRecord(body) || !isIncidentSeverity(body['severity'])) {
    return undefined;
  }
  const title = text(body['title'], 120);
  const service = text(body['service'], 80);
  if (title === undefined || service === undefined) {
    return undefined;
  }
  return { title, severity: body['severity'], service };
}

function parseEvent(body: unknown, sequence: number): IncidentEvent | undefined {
  if (!isRecord(body) || !isEventKind(body['kind'])) {
    return undefined;
  }
  const at = instant(body['at']);
  const message = text(body['message'], 500);
  if (at === undefined || message === undefined) {
    return undefined;
  }
  const service =
    body['service'] === undefined || body['service'] === null ? null : text(body['service'], 80);
  if (service === undefined) {
    return undefined;
  }
  return { at, kind: body['kind'] satisfies EventKind, message, service, sequence };
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
