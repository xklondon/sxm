import net from 'node:net';

function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/** Pick the first free port from candidates, or any free port if none listed. */
export async function findAvailablePort(candidates: number[]): Promise<number> {
  const unique = [...new Set(candidates.filter((p) => p > 0 && p < 65536))];
  for (const port of unique) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
