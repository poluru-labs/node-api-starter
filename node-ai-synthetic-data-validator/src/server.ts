import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { App } from './app.ts';
import type { AppConfig } from './config.ts';

export interface RunningServer {
  readonly url: string;
  readonly port: number;
  close(forceAfterMs?: number): Promise<void>;
}

export function listen(app: App, config: Pick<AppConfig, 'host' | 'port'>): Promise<RunningServer> {
  const server = createServer((request, response) => {
    void app.handle(request, response);
  });

  server.on('clientError', (_error, socket) => {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    } else {
      socket.destroy();
    }
  });

  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onError);
    server.listen(config.port, config.host, () => {
      server.off('error', onError);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Server did not bind to a TCP port'));
        return;
      }
      resolve(toRunningServer(server, config.host, address));
    });
  });
}

function toRunningServer(server: Server, host: string, address: AddressInfo): RunningServer {
  return {
    url: `http://${formatHost(host)}:${String(address.port)}`,
    port: address.port,
    close(forceAfterMs = 10_000) {
      return closeServer(server, forceAfterMs);
    },
  };
}

function formatHost(host: string): string {
  if (host === '0.0.0.0' || host === '::') {
    return '127.0.0.1';
  }
  return host.includes(':') ? `[${host}]` : host;
}

function closeServer(server: Server, forceAfterMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.closeAllConnections();
    }, forceAfterMs);
    timer.unref();

    server.close((error) => {
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
