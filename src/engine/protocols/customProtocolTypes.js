/** Custom protocol rule types — no arbitrary code execution. */
export const CUSTOM_PROTOCOL_ID_PREFIX = 'custom:';
export function isCustomProtocolId(protocolId) {
    return protocolId.startsWith(CUSTOM_PROTOCOL_ID_PREFIX);
}
export function customProtocolStorageId(customProtocolId) {
    return `${CUSTOM_PROTOCOL_ID_PREFIX}${customProtocolId}`;
}
