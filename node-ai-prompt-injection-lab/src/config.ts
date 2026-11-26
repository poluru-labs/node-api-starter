export const nodeEnvironments = ['development', 'test', 'production'] as const;
export type NodeEnvironment = (typeof nodeEnvironments)[number];

export const logLevels = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof logLevels)[number];

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly nodeEnv: NodeEnvironment;
  readonly logLevel: LogLevel;
  readonly serviceName: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = readEnum(env, 'NODE_ENV', nodeEnvironments, 'development');
  return {
    host: readString(env, 'HOST', '0.0.0.0'),
    port: readPort(env, 'PORT', 3000),
    nodeEnv,
    logLevel: readEnum(env, 'LOG_LEVEL', logLevels, nodeEnv === 'production' ? 'info' : 'debug'),
    serviceName: readString(env, 'SERVICE_NAME', 'node-ai-prompt-injection-lab'),
  };
}

function readString(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value.trim();
}

function readPort(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new ConfigError(`${key} must be an integer from 0 to 65535`);
  }
  return port;
}

function readEnum<T extends string>(
  env: NodeJS.ProcessEnv,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const candidate = value.trim();
  if (!isAllowed(candidate, allowed)) {
    throw new ConfigError(`${key} must be one of: ${allowed.join(', ')}`);
  }
  return candidate;
}

function isAllowed<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.some((item) => item === value);
}
