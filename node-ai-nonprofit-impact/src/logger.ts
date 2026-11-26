import type { LogLevel } from './config.ts';

const severity: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, fields?: Readonly<Record<string, unknown>>): void;
  info(message: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(message: string, fields?: Readonly<Record<string, unknown>>): void;
  error(message: string, fields?: Readonly<Record<string, unknown>>): void;
  child(fields: Readonly<Record<string, unknown>>): Logger;
}

export function createLogger(options: {
  readonly level: LogLevel;
  readonly service: string;
  readonly stream?: NodeJS.WritableStream;
  readonly bindings?: Readonly<Record<string, unknown>>;
}): Logger {
  const stream = options.stream ?? process.stdout;
  const threshold = severity[options.level];
  const bindings = options.bindings ?? {};

  const write = (
    level: LogLevel,
    message: string,
    fields: Readonly<Record<string, unknown>> = {},
  ): void => {
    if (severity[level] < threshold) {
      return;
    }
    const entry = {
      time: new Date().toISOString(),
      level,
      service: options.service,
      message,
      ...bindings,
      ...fields,
    };
    stream.write(`${JSON.stringify(entry)}\n`);
  };

  return {
    debug(message, fields) {
      write('debug', message, fields ?? {});
    },
    info(message, fields) {
      write('info', message, fields ?? {});
    },
    warn(message, fields) {
      write('warn', message, fields ?? {});
    },
    error(message, fields) {
      write('error', message, fields ?? {});
    },
    child(fields) {
      return createLogger({
        level: options.level,
        service: options.service,
        stream,
        bindings: { ...bindings, ...fields },
      });
    },
  };
}
