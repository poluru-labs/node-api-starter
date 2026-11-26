import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { requestJson } from './http.ts';

test('entrypoint listens and exits on SIGTERM', { timeout: 15_000 }, async () => {
  const root = path.join(import.meta.dirname, '..');
  const child = spawn(process.execPath, ['src/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      SERVICE_NAME: 'node-boilerplate-test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
  });

  try {
    const url = await waitForListening(() => stdout, child);
    const health = await requestJson(url, '/health');
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { status: 'ok', service: 'node-boilerplate-test' });

    child.kill('SIGTERM');
    const [code] = (await once(child, 'exit')) as [number | null];
    assert.equal(code, 0, stderr);
  } catch (error) {
    child.kill('SIGKILL');
    const message = error instanceof Error ? error.message : 'failed';
    throw new Error(`${message}\n${stderr}\n${stdout}`, { cause: error });
  }
});

async function waitForListening(readStdout: () => string, child: ChildProcess): Promise<string> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${String(child.exitCode)}`);
    }
    const url = listeningUrl(readStdout());
    if (url !== undefined) {
      return url;
    }
    await delay(20);
  }
  throw new Error('timed out waiting for the server to listen');
}

function listeningUrl(stdout: string): string | undefined {
  for (const line of stdout.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      continue;
    }
    const record = parsed as Record<string, unknown>;
    if (record['message'] === 'listening' && typeof record['url'] === 'string') {
      return record['url'];
    }
  }
  return undefined;
}
