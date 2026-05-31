import type { CustomBlackjackProtocol } from '../engine/protocols/customProtocolTypes';
import { customProtocolStorageId } from '../engine/protocols/customProtocolTypes';

const STORAGE_KEY = 'sxmcards:custom-protocols';

export function loadCustomProtocols(): CustomBlackjackProtocol[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as CustomBlackjackProtocol[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomProtocols(protocols: CustomBlackjackProtocol[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(protocols));
}

export function saveCustomProtocol(protocol: CustomBlackjackProtocol): CustomBlackjackProtocol[] {
  const all = loadCustomProtocols().filter(
    (p) => p.customProtocolId !== protocol.customProtocolId,
  );
  all.push(protocol);
  saveCustomProtocols(all);
  return all;
}

export function findCustomProtocolByStorageId(
  storageId: string,
): CustomBlackjackProtocol | undefined {
  if (!storageId.startsWith('custom:')) {
    return undefined;
  }
  const id = storageId.slice('custom:'.length);
  return loadCustomProtocols().find((p) => p.customProtocolId === id);
}

export function customProtocolSelectId(protocol: CustomBlackjackProtocol): string {
  return customProtocolStorageId(protocol.customProtocolId);
}
