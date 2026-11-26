import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.ts';
import type { App, RequestContext, Route, RouteHandler } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import type { AppConfig, LogLevel, NodeEnvironment } from './config.ts';
import { createLogger } from './logger.ts';
import type { Logger } from './logger.ts';
import { listen } from './server.ts';
import type { RunningServer } from './server.ts';

export { isChannel, scanText } from './scan.ts';
export type { Channel, ScanFinding, ScanReport, ScanSeverity } from './scan.ts';
export { createRoutes, createScanStore } from './routes.ts';
export { createMockRoutes, loadMockSpec } from './mock-api.ts';
export type { MockRecord, MockSpec } from './mock-api.ts';
export { ConfigError, createApp, createLogger, listen, loadConfig };
export type {
  App,
  AppConfig,
  LogLevel,
  Logger,
  NodeEnvironment,
  RequestContext,
  Route,
  RouteHandler,
  RunningServer,
};

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined || entry.length === 0) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  const { main } = await import('./main.ts');
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`fatal: ${message}\n`);
    process.exitCode = 1;
  }
}
