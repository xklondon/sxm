/** Custom protocol rule types — no arbitrary code execution. */

export type CustomRuleType = 'executable' | 'social';

export type CustomRuleTrigger =
  | 'hand-condition'
  | 'card-condition'
  | 'phase'
  | 'always';

export interface CustomProtocolRule {
  ruleId: string;
  title: string;
  description: string;
  ruleType: CustomRuleType;
  trigger: CustomRuleTrigger;
  effect: string;
  isEnabled: boolean;
  /** When executable but not yet implemented in engine. */
  notYetExecutable?: boolean;
}

export interface ProtocolSpecificMessages {
  bettingMessage?: string;
  dealMessage?: string;
  playerTurnMessage?: string;
  bankTurnMessage?: string;
  payoutMessage?: string;
  customRuleReminder?: string;
}

export interface CustomBlackjackProtocol {
  baseProtocolId: string;
  customProtocolId: string;
  name: string;
  description: string;
  rules: CustomProtocolRule[];
  protocolSpecificMessages: ProtocolSpecificMessages;
  createdAt: string;
}

export const CUSTOM_PROTOCOL_ID_PREFIX = 'custom:';

export function isCustomProtocolId(protocolId: string): boolean {
  return protocolId.startsWith(CUSTOM_PROTOCOL_ID_PREFIX);
}

export function customProtocolStorageId(customProtocolId: string): string {
  return `${CUSTOM_PROTOCOL_ID_PREFIX}${customProtocolId}`;
}
