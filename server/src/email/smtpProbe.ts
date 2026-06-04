import net from 'node:net';

const PROBE_TIMEOUT_MS = 4_000;

let cachedReachable: boolean | null = null;

function env(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function isGmailSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h.includes('gmail.com') || h.includes('google.com');
}

export function getSmtpTcpReachabilityCache(): boolean | null {
  return cachedReachable;
}

export function setSmtpTcpReachability(ok: boolean | null): void {
  cachedReachable = ok;
  if (ok === null) {
    delete process.env.SMTP_TCP_REACHABLE;
    return;
  }
  process.env.SMTP_TCP_REACHABLE = ok ? 'true' : 'false';
}

/** Quick TCP connect test — does not speak SMTP. */
export function probeSmtpTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!host) {
      resolve(false);
      return;
    }
    const socket = net.connect({ host, port, timeout: PROBE_TIMEOUT_MS });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export async function probeConfiguredSmtpReachability(): Promise<boolean> {
  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT') || '587');
  if (!host) {
    setSmtpTcpReachability(false);
    return false;
  }
  const ok = await probeSmtpTcp(host, port);
  setSmtpTcpReachability(ok);
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] SMTP TCP probe host=${host} port=${port} reachable=${ok}`);
  return ok;
}
