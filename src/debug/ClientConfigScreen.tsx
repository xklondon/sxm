import { formatClientConfig, getClientConfigSnapshot } from '../api/config';

export const CLIENT_CONFIG_PATH = '/debug/client-config';

/** True for /debug/client-config (also under a base path). Auth not required. */
export function isClientConfigPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '');
  return clean === CLIENT_CONFIG_PATH || clean.endsWith(CLIENT_CONFIG_PATH);
}

/** Standalone, auth-free page that dumps the live client URL/config. */
export function ClientConfigScreen() {
  const snapshot = getClientConfigSnapshot();
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 24,
        color: '#f4f4f4',
        background: '#0b1f17',
        font: '13px/1.6 ui-monospace, Menlo, Consolas, monospace',
      }}
    >
      <h1 style={{ fontSize: 18, marginTop: 0 }}>SXM client config</h1>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {formatClientConfig(snapshot)}
      </pre>
      <p style={{ opacity: 0.7 }}>
        Single-origin host: apiBase and socketBase should equal location.origin, and VITE_*
        should be blank. Any 10.x / 192.168.x here means a stale baked build.
      </p>
    </main>
  );
}
