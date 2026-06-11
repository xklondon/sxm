import { Router } from 'express';
import type { TableService } from '../tables/service.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { respondPeopleAuthError } from '../people/httpErrors.js';
import type { IouHandoffService } from './service.js';
import type { IouHandoffCreateRequestBody } from '../../../src/lib/iouHandoffPayload.js';

export function createIouHandoffRouter(
  handoff: IouHandoffService,
  tables: TableService,
): Router {
  const router = Router();

  router.post('/create', requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (!handoff.isConfigured()) {
        res.status(503).json({ ok: false, error: 'IOU handoff is not configured on this server.' });
        return;
      }

      const body = req.body as IouHandoffCreateRequestBody;
      const tableId = String(body?.tableId ?? '').trim();
      let tableState = null;
      if (tableId) {
        try {
          const table = await tables.getTableForUser(
            tableId,
            req.auth!.userId,
            req.auth!.email,
          );
          tableState = table.state;
        } catch {
          // Offline/local tables may not exist server-side — fall back to request body.
          tableState = null;
        }
      }

      const result = await handoff.createFromRequest(req.auth!.email, body, tableState);
      res.json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      const message = err instanceof Error ? err.message : 'IOU handoff failed';
      const status =
        message.includes('required') ||
        message.includes('different people') ||
        message.includes('not a party')
          ? 400
          : 502;
      res.status(status).json({ ok: false, error: message });
    }
  });

  return router;
}
