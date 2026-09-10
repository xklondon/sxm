import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';
import {
  config,
  assertProductionOrigin,
  getCorsOrigins,
  getEffectivePublicOrigin,
  isCorsOriginAllowed,
} from './config.js';
import { getJoinAddress, renderQrDataUrl } from './host.js';
import { createMemoryStore } from './store/memoryStore.js';
import type { Store } from './store/types.js';
import type { StoreType } from './store/types.js';
import { AuthService } from './auth/service.js';
import { createAuthRouter } from './auth/routes.js';
import { PeopleService } from './people/service.js';
import { createPeopleRouter } from './people/routes.js';
import { TableService } from './tables/service.js';
import { createTableRouter } from './tables/routes.js';
import { createDevRouter } from './dev/routes.js';
import { createEmailDebugRouter } from './debug/emailRoutes.js';
import { createRuntimeDebugRouter } from './debug/runtimeRoutes.js';
import { createApiErrorHandler } from './middleware/apiErrorHandler.js';
import { verifySessionToken } from './auth/tokens.js';
import { readSessionToken } from './auth/middleware.js';
import { IouHandoffService } from './iouHandoff/service.js';
import { createIouHandoffRouter } from './iouHandoff/routes.js';

export interface CreateAppOptions {
  store?: Store;
  storeType?: StoreType;
}

export function createApp(options: CreateAppOptions = {}) {
  assertProductionOrigin();
  const startedAt = Date.now();
  const store = options.store ?? createMemoryStore();
  const storeType = options.storeType ?? 'memory';
  const people = new PeopleService(store);
  const auth = new AuthService(store, people);
  const tables = new TableService(store, people);
  const iouHandoff = new IouHandoffService({
    enabled: config.iouHandoff.enabled,
    source: config.iouHandoff.source,
    secret: config.iouHandoff.secret,
    createUrl: config.iouHandoff.createUrl,
  });

  const app = express();
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: getCorsOrigins(), credentials: true },
  });

  const corsOrigins = getCorsOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin, corsOrigins)) {
          callback(null, true);
          return;
        }
        if (config.isProduction) {
          // eslint-disable-next-line no-console
          console.warn(`[SXM] CORS blocked origin: ${origin ?? '(none)'}`);
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({ ok: true, service: 'sxmcards-api', env: config.nodeEnv });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.get('/api/host/status', async (_req, res) => {
    const address = getEffectivePublicOrigin();
    const joinAddress = getJoinAddress({ port: config.vitePort });
    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await renderQrDataUrl(joinAddress);
    } catch {
      qrDataUrl = null;
    }
    res.json({
      status: 'running',
      address,
      joinAddress,
      players: io.engine.clientsCount,
      port: config.vitePort,
      qrDataUrl,
    });
  });

  const debugRouter = express.Router();
  debugRouter.use(createEmailDebugRouter());
  debugRouter.use(createRuntimeDebugRouter({ store, io, startedAt, storeType }));
  app.use('/api/debug', debugRouter);
  app.use('/api/auth', createAuthRouter(auth, people, tables, io));
  app.use('/api/people', createPeopleRouter(people, auth));
  app.use('/api/tables', createTableRouter(tables, io));
  app.use('/api/iou-handoff', createIouHandoffRouter(iouHandoff, tables));

  if (!config.isProduction) {
    app.use('/api/dev', createDevRouter());
  }

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'API route not found',
      method: req.method,
      path: req.originalUrl,
    });
  });

  if (config.serveStatic) {
    const distDir = path.resolve(fileURLToPath(import.meta.url), '../../../dist');
    const assetsDir = path.join(distDir, 'assets');

    // 1. Hashed build assets only — never fall through to SPA index.html.
    app.use(
      '/assets',
      express.static(assetsDir, {
        index: false,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );

    // 2. Missing /assets/* → plain 404 (stale hashed names after redeploy).
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });

    // 3. Other dist root files (favicon.svg, etc.) — not index.html (index: false).
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
          }
        },
      }),
    );

    // 4. SPA fallback: extensionless app routes only; never HTML for asset paths.
    app.use((req, res) => {
      if (req.path.startsWith('/assets')) {
        res.status(404).type('text/plain').send('Asset not found');
        return;
      }
      if (path.extname(req.path)) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  io.use((socket, next) => {
    const req = socket.request as express.Request;
    const token = readSessionToken(req);
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }
    const payload = verifySessionToken(token);
    if (!payload) {
      next(new Error('Unauthorized'));
      return;
    }
    socket.data.userId = payload.userId;
    next();
  });

  io.on('connection', (socket) => {
    socket.on('table:subscribe', async (tableId: string) => {
      // Same membership resolution as GET /api/tables/:tableId — a session
      // alone must not grant a live feed of any table's state.
      try {
        await tables.getTableForUser(String(tableId), socket.data.userId as string);
      } catch {
        socket.emit('table:subscribe:denied', { tableId });
        return;
      }
      const prev = socket.data.subscribedTableId as string | undefined;
      if (prev && prev !== tableId) {
        socket.leave(`table:${prev}`);
      }
      socket.data.subscribedTableId = tableId;
      socket.join(`table:${tableId}`);
    });

    socket.on('table:unsubscribe', (tableId: string) => {
      socket.leave(`table:${tableId}`);
      if (socket.data.subscribedTableId === tableId) {
        socket.data.subscribedTableId = undefined;
      }
    });

    socket.on('disconnect', () => {
      socket.data.subscribedTableId = undefined;
    });
  });

  return { app, httpServer, io, store, storeType, tables, auth, people };
}
