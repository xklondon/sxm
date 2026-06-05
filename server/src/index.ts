import './loadEnv.js';
import { createApp } from './app.js';
import { createStore } from './store/createStore.js';
import { config, getCorsOrigins, getEffectivePublicOrigin, isSmtpConfigured } from './config.js';
import { probeConfiguredSmtpReachability } from './email/smtpProbe.js';

const { store, storeType, disconnect } = await createStore();
const { httpServer } = createApp({ store, storeType });

if (disconnect) {
  const shutdown = () => {
    void disconnect();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (isSmtpConfigured() && process.env.VITEST !== 'true') {
  void probeConfiguredSmtpReachability();
}

httpServer.listen(config.port, config.host, () => {
  if (config.isProduction) {
    console.log(`[SXM] Server listening on ${config.host}:${config.port} (${config.nodeEnv})`);
    console.log(`[SXM] Public origin: ${getEffectivePublicOrigin()}`);
    console.log(`[SXM] CORS allowed origins: ${getCorsOrigins().join(', ')}`);
    console.log(`[SXM] Store: ${storeType}`);
  } else {
    console.log(`[SXM] API ready: http://${config.host}:${config.port}`);
    console.log(`[SXM] Effective public origin: ${getEffectivePublicOrigin()}${config.devPublicOriginAuto ? ' (DEV_PUBLIC_ORIGIN=auto)' : ''}`);
    console.log(`[SXM] Store: ${storeType}`);
  }
});
