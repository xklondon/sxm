import { Router } from 'express';
import type { TableService } from '../tables/service.js';
import { TableNotFoundError } from '../tables/errors.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { respondPeopleAuthError } from '../people/httpErrors.js';
import { getIouHandoffNotConfiguredMessage } from '../config.js';
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
        res.status(503).json({ ok: false, error: getIouHandoffNotConfiguredMessage() });
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
        } catch (err) {
          if (err instanceof TableNotFoundError) {
            // Offline/local tables may not exist server-side — fall back to
            // the request body (parties still validated against the viewer).
            tableState = null;
          } else {
            // The table EXISTS but this session may not read it (membership /
            // auth failure): fail closed rather than validating an IOU against
            // unverifiable client-supplied party data.
            res.status(403).json({
              ok: false,
              error: 'You are not a member of the table referenced by this IOU.',
            });
            return;
          }
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
