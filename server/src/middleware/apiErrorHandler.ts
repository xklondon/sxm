import type { ErrorRequestHandler, Request } from 'express';

function routeContext(req: Request): Record<string, string> {
  return {
    method: req.method,
    path: req.originalUrl || req.path,
  };
}

/** Logs API failures and always responds with JSON (no raw stack to clients). */
export function createApiErrorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const ctx = routeContext(req);
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[SXM][api-error]', { ...ctx, message, name: err instanceof Error ? err.name : 'Error' });

    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status: number }).status === 'number'
        ? (err as { status: number }).status
        : 500;

    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: isProduction && status >= 500 ? 'Internal server error' : message || 'Internal server error',
      ...ctx,
    });
  };
}
