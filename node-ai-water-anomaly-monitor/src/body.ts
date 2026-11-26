import type { IncomingMessage } from 'node:http';

const defaultMaxBytes = 1_048_576;

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonBody(
  request: IncomingMessage,
  reply: (status: number, body: unknown) => void,
  maxBytes = defaultMaxBytes,
): Promise<unknown> {
  try {
    return await readJson(request, maxBytes);
  } catch (error) {
    if (error instanceof HttpError) {
      reply(error.status, { error: error.code });
      return undefined;
    }
    throw error;
  }
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const contentType = request.headers['content-type'];
  if (typeof contentType === 'string' && !contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBytes) {
      throw new HttpError(413, 'payload_too_large', 'Request body exceeds the configured limit');
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text.length === 0) {
    throw new HttpError(400, 'invalid_json', 'Request body must be JSON');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON');
  }
}
