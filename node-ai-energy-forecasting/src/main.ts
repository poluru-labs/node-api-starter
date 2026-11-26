import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createRoutes } from './routes.ts';
import { createLogger } from './logger.ts';
import type { Logger } from './logger.ts';
import { listen } from './server.ts';
import type { RunningServer } from './server.ts';

const shutdownTimeoutMs = 10_000;

export async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, service: config.serviceName });
  const app = createApp({ config, logger, routes: createRoutes() });
  const server = await listen(app, config);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.setReady(false);
    logger.info('shutting down', { signal });
    void closeAndExit(server, logger);
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  app.setReady(true);
  logger.info('listening', { url: server.url, port: server.port });
}

async function closeAndExit(server: RunningServer, logger: Logger): Promise<void> {
  try {
    await server.close(shutdownTimeoutMs);
  } catch (error) {
    logger.error('shutdown failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    process.exitCode = 1;
  }
  process.exit();
}
