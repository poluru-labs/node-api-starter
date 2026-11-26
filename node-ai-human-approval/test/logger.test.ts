import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createLogger } from '../src/logger.ts';

test('logger drops messages below the configured level', () => {
  const captured = capture();
  const logger = createLogger({
    level: 'info',
    service: 'node-boilerplate',
    stream: captured.stream,
  });

  logger.debug('hidden');
  logger.info('visible', { requestId: 'abc' });

  const lines = captured.read();
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], {
    time: timeOf(lines[0]),
    level: 'info',
    service: 'node-boilerplate',
    message: 'visible',
    requestId: 'abc',
  });
});

test('child loggers keep parent bindings', () => {
  const captured = capture();
  const logger = createLogger({
    level: 'error',
    service: 'node-boilerplate',
    stream: captured.stream,
    bindings: { serviceVersion: '1.0.0' },
  });

  logger.child({ requestId: 'req-1' }).error('failed', { status: 500 });

  assert.deepEqual(captured.read(), [
    {
      time: timeOf(captured.read()[0]),
      level: 'error',
      service: 'node-boilerplate',
      message: 'failed',
      serviceVersion: '1.0.0',
      requestId: 'req-1',
      status: 500,
    },
  ]);
});

function capture(): { stream: Writable; read(): LogLine[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: unknown, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : textOf(chunk));
      callback();
    },
  });
  return {
    stream,
    read() {
      return chunks
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => parseLine(line));
    },
  };
}

interface LogLine {
  readonly time: string;
  readonly level: string;
  readonly service: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

function parseLine(line: string): LogLine {
  const parsed: unknown = JSON.parse(line);
  assert.equal(typeof parsed, 'object');
  assert.notEqual(parsed, null);
  return parsed as LogLine;
}

function timeOf(line: LogLine | undefined): string {
  assert.ok(line);
  assert.match(line.time, /^\d{4}-\d{2}-\d{2}T/);
  return line.time;
}

function textOf(chunk: unknown): string {
  if (typeof chunk === 'string') {
    return chunk;
  }
  return '';
}
