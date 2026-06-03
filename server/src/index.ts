import './loadEnv.js';
import { createApp } from './app.js';
import { config, getCorsOrigins, getEffectivePublicOrigin } from './config.js';

const { httpServer } = createApp();

httpServer.listen(config.port, config.host, () => {
  if (config.isProduction) {
    console.log(`[SXM] Server listening on ${config.host}:${config.port} (${config.nodeEnv})`);
    console.log(`[SXM] Public origin: ${getEffectivePublicOrigin()}`);
    console.log(`[SXM] CORS allowed origins: ${getCorsOrigins().join(', ')}`);
  } else {
    console.log(`[SXM] API ready: http://${config.host}:${config.port}`);
    console.log(`[SXM] Effective public origin: ${getEffectivePublicOrigin()}${config.devPublicOriginAuto ? ' (DEV_PUBLIC_ORIGIN=auto)' : ''}`);
  }
});