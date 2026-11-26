import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config.ts';

test('loadConfig uses defaults when the environment is empty', () => {
  assert.deepEqual(loadConfig({}), {
    host: '0.0.0.0',
    port: 3000,
    nodeEnv: 'development',
    logLevel: 'debug',
    serviceName: 'node-ai-documentation-checker',
  });
});

test('loadConfig reads and trims environment values', () => {
  assert.deepEqual(
    loadConfig({
      HOST: ' 127.0.0.1 ',
      PORT: '8080',
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
      SERVICE_NAME: ' billing-api ',
    }),
    {
      host: '127.0.0.1',
      port: 8080,
      nodeEnv: 'production',
      logLevel: 'warn',
      serviceName: 'billing-api',
    },
  );
});

test('production defaults the log level to info', () => {
  const config = loadConfig({ NODE_ENV: 'production' });
  assert.equal(config.logLevel, 'info');
});

test('blank values fall back to defaults', () => {
  const config = loadConfig({ HOST: ' ', PORT: '', SERVICE_NAME: ' ' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 3000);
  assert.equal(config.serviceName, 'node-ai-documentation-checker');
});

test('port 0 is valid', () => {
  assert.equal(loadConfig({ PORT: '0' }).port, 0);
});

test('loadConfig rejects an invalid port', () => {
  assert.throws(() => loadConfig({ PORT: '65536' }), ConfigError);
  assert.throws(() => loadConfig({ PORT: 'nope' }), ConfigError);
});

test('loadConfig rejects an unknown environment name', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'staging' }), ConfigError);
  assert.throws(() => loadConfig({ LOG_LEVEL: 'verbose' }), ConfigError);
});
