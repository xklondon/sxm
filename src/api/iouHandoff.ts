import { apiPath } from './config';
import type {
  IouHandoffCreateRequestBody,
  IouHandoffCreateResponse,
} from '../lib/iouHandoffPayload';

async function handoffFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(apiPath(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Server-side encrypted IOU create — never sends the partner secret to the browser. */
export async function createIouHandoff(
  body: IouHandoffCreateRequestBody,
): Promise<IouHandoffCreateResponse> {
  const res = await handoffFetch('/api/iou-handoff/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  let data: IouHandoffCreateResponse;
  try {
    data = (await res.json()) as IouHandoffCreateResponse;
  } catch {
    return { ok: false, error: 'Could not parse IOU handoff response.' };
  }

  if (!res.ok && data.ok === false) {
    return data;
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `IOU handoff failed (${res.status}).`,
    };
  }

  return data;
}
