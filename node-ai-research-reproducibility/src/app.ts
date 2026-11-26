import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from './config.ts';
import type { Logger } from './logger.ts';

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestContext {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly url: URL;
  readonly requestId: string;
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly params: Readonly<Record<string, string>>;
  sendJson(status: number, body: unknown): void;
}

export type RouteHandler = (ctx: RequestContext) => Promise<void> | void;

export interface Route {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: RouteHandler;
}

export interface App {
  handle(request: IncomingMessage, response: ServerResponse): Promise<void>;
  setReady(ready: boolean): void;
}

export interface CreateAppOptions {
  readonly config: AppConfig;
  readonly logger: Logger;
  /** Extra routes. Built-in `/health` and `/ready` stay in front and always win. */
  readonly routes?: readonly Route[];
}

export function createApp(options: CreateAppOptions): App {
  let ready = false;
  const { config, logger } = options;
  const routes: readonly Route[] = [
    { method: 'GET', path: '/health', handler: health },
    {
      method: 'GET',
      path: '/ready',
      handler: (ctx) => {
        readiness(ctx, ready);
      },
    },
    ...(options.routes ?? [{ method: 'GET', path: '/', handler: root }]),
  ];

  return {
    setReady(next: boolean) {
      ready = next;
    },
    async handle(request, response) {
      const started = performance.now();
      const requestId = readRequestId(request);
      const url = parseRequestUrl(request);
      const requestLogger = logger.child({
        requestId,
        method: request.method ?? 'UNKNOWN',
        path: url?.pathname ?? '',
      });

      const finish = (): void => {
        requestLogger.info('request completed', {
          status: response.statusCode,
          durationMs: Math.round(performance.now() - started),
        });
      };

      if (url === undefined) {
        sendJson(response, 400, { error: 'bad_request' }, requestId);
        finish();
        return;
      }

      const method = request.method ?? 'GET';
      const candidates = routes.flatMap((route) => {
        const params = matchPattern(route.path, url.pathname);
        return params === undefined ? [] : [{ route, params }];
      });
      const matched = candidates.find((candidate) => candidate.route.method === method);
      const ctx: RequestContext = {
        request,
        response,
        url,
        requestId,
        config,
        logger: requestLogger,
        params: matched?.params ?? {},
        sendJson(status, body) {
          sendJson(response, status, body, requestId);
        },
      };

      try {
        if (candidates.length === 0) {
          ctx.sendJson(404, { error: 'not_found' });
        } else if (matched === undefined) {
          response.setHeader(
            'allow',
            uniqueMethods(candidates.map((candidate) => candidate.route)),
          );
          ctx.sendJson(405, { error: 'method_not_allowed' });
        } else {
          await matched.route.handler(ctx);
          if (!response.headersSent && !response.writableEnded) {
            ctx.sendJson(500, { error: 'empty_response' });
          }
        }
      } catch (error) {
        requestLogger.error('request failed', {
          error: error instanceof Error ? error.message : 'unknown',
        });
        if (!response.headersSent && !response.writableEnded) {
          ctx.sendJson(500, errorBody(config, requestId, error));
        }
      } finally {
        finish();
      }
    },
  };
}

function health(ctx: RequestContext): void {
  ctx.sendJson(200, { status: 'ok', service: ctx.config.serviceName });
}

function readiness(ctx: RequestContext, isReady: boolean): void {
  if (!isReady) {
    ctx.sendJson(503, { status: 'not_ready' });
    return;
  }
  ctx.sendJson(200, { status: 'ready' });
}

function root(ctx: RequestContext): void {
  ctx.sendJson(200, {
    service: ctx.config.serviceName,
    message: 'Service is running.',
  });
}

function errorBody(config: AppConfig, requestId: string, error: unknown): unknown {
  if (config.nodeEnv === 'production') {
    return { error: 'internal_error' };
  }
  return {
    error: 'internal_error',
    requestId,
    message: error instanceof Error ? error.message : 'unknown',
  };
}

function uniqueMethods(routes: readonly Route[]): string {
  return [...new Set(routes.map((route) => route.method))].join(', ');
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | undefined {
  const expectedParts = pattern.split('/').filter((part) => part.length > 0);
  const actualParts = pathname.split('/').filter((part) => part.length > 0);
  if (expectedParts.length !== actualParts.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (let index = 0; index < expectedParts.length; index += 1) {
    const expected = expectedParts[index];
    const actual = actualParts[index];
    if (expected === undefined || actual === undefined) {
      return undefined;
    }
    if (expected.startsWith(':')) {
      const name = expected.slice(1);
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
        return undefined;
      }
      try {
        params[name] = decodeURIComponent(actual);
      } catch {
        return undefined;
      }
      continue;
    }
    if (expected !== actual) {
      return undefined;
    }
  }
  return params;
}

function readRequestId(request: IncomingMessage): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value !== undefined && requestIdPattern.test(value)) {
    return value;
  }
  return randomUUID();
}

function parseRequestUrl(request: IncomingMessage): URL | undefined {
  const raw = request.url;
  if (!raw?.startsWith('/')) {
    return undefined;
  }
  try {
    return new URL(raw, 'http://127.0.0.1');
  } catch {
    return undefined;
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  requestId: string,
): void {
  if (response.headersSent || response.writableEnded) {
    return;
  }
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-request-id': requestId,
  });
  response.end(payload);
}
