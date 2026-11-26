import { request } from 'node:http';

export interface HttpResult {
  readonly status: number;
  readonly allow: string | undefined;
  readonly requestId: string | undefined;
  readonly contentType: string | undefined;
  readonly body: unknown;
}

export function requestJson(
  baseUrl: string,
  pathname: string,
  init: { readonly method?: string; readonly requestId?: string; readonly body?: unknown } = {},
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    const payload = init.body === undefined ? undefined : JSON.stringify(init.body);
    if (init.requestId !== undefined) {
      headers['x-request-id'] = init.requestId;
    }
    if (payload !== undefined) {
      headers['content-type'] = 'application/json; charset=utf-8';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }

    const req = request(
      new URL(pathname, baseUrl),
      { method: init.method ?? 'GET', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            allow: singleHeader(res.headers.allow),
            requestId: singleHeader(res.headers['x-request-id']),
            contentType: singleHeader(res.headers['content-type']),
            body: text.length === 0 ? null : parseJson(text),
          });
        });
      },
    );
    req.on('error', reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function parseJson(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}
