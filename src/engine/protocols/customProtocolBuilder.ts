import { generateId } from '../utils/id';
import { LAS_VEGAS_PROTOCOL } from '../blackjack/protocols/lasVegasProtocol';
import { EUROPEAN_SHOE_PROTOCOL } from '../blackjack/protocols/europeanShoeProtocol';
import { CLASSIC_HOME_PROTOCOL } from '../blackjack/protocols/classicHomeProtocol';
import { protocolToBlackjackSettings } from '../blackjack/protocols/index';
import type { BlackjackProtocol } from '../blackjack/protocols/types';
import type {
  CustomBlackjackProtocol,
  CustomProtocolRule,
  ProtocolSpecificMessages,
} from './customProtocolTypes';
import { customProtocolStorageId } from './customProtocolTypes';

const BASE_PRESETS: BlackjackProtocol[] = [
  LAS_VEGAS_PROTOCOL,
  EUROPEAN_SHOE_PROTOCOL,
  CLASSIC_HOME_PROTOCOL,
];

function getBaseProtocol(protocolId: string): BlackjackProtocol {
  return BASE_PRESETS.find((p) => p.protocolId === protocolId) ?? LAS_VEGAS_PROTOCOL;
}

export interface CreateCustomProtocolInput {
  baseProtocolId: string;
  name: string;
  description: string;
  rules: Array<Omit<CustomProtocolRule, 'ruleId'> & { ruleId?: string }>;
  protocolSpecificMessages?: ProtocolSpecificMessages;
}

function normalizeRule(
  rule: Omit<CustomProtocolRule, 'ruleId'> & { ruleId?: string },
): CustomProtocolRule {
  const ruleType = rule.ruleType;
  const notYetExecutable =
    ruleType === 'executable' &&
    (rule.notYetExecutable ?? rule.trigger !== 'phase');
  return {
    ...rule,
    ruleId: rule.ruleId ?? generateId(),
    notYetExecutable,
  };
}

export function createCustomProtocol(input: CreateCustomProtocolInput): CustomBlackjackProtocol {
  const base = getBaseProtocol(input.baseProtocolId);
  if (!input.name.trim()) {
    throw new Error('Custom protocol name is required.');
  }

  const customProtocolId = generateId();
  const rules = input.rules.map(normalizeRule);

  const socialReminders = rules
    .filter((r) => r.isEnabled && r.ruleType === 'social')
    .map((r) => r.title)
    .join('; ');

  return {
    baseProtocolId: base.protocolId,
    customProtocolId,
    name: input.name.trim(),
    description: input.description.trim() || `Based on ${base.displayName}.`,
    rules,
    protocolSpecificMessages: {
      ...input.protocolSpecificMessages,
      customRuleReminder: socialReminders || input.protocolSpecificMessages?.customRuleReminder,
    },
    createdAt: new Date().toISOString(),
  };
}

/** Resolve custom protocol to runtime preset shape (inherits base engine rules). */
export function resolveCustomProtocolToPreset(
  custom: CustomBlackjackProtocol,
): BlackjackProtocol {
  const base = getBaseProtocol(custom.baseProtocolId);
  const storageId = customProtocolStorageId(custom.customProtocolId);
  const enabledExecutable = custom.rules.filter(
    (r) => r.isEnabled && r.ruleType === 'executable' && !r.notYetExecutable,
  );

  return {
    ...base,
    protocolId: storageId,
    displayName: custom.name,
    shortDescription: custom.description,
    id: storageId,
    name: custom.name,
    summary: custom.description,
    displayRules: [
      ...base.displayRules,
      { id: 'custom-base', label: 'Based on', value: base.displayName },
      ...custom.rules
        .filter((r) => r.isEnabled)
        .map((r) => ({
          id: r.ruleId,
          label: r.ruleType === 'social' ? `Social: ${r.title}` : r.title,
          value:
            r.ruleType === 'executable' && r.notYetExecutable
              ? `${r.description} (not yet executable)`
              : r.description,
        })),
    ],
    extensions: {
      ...base.extensions,
      alteredPayouts: {
        ...base.extensions.alteredPayouts,
        ...Object.fromEntries(
          enabledExecutable.map((r) => [r.ruleId, r.effect]),
        ),
      },
    },
  };
}

export function getCustomProtocolSettings(custom: CustomBlackjackProtocol) {
  return protocolToBlackjackSettings(resolveCustomProtocolToPreset(custom));
}

export function listEnabledSocialRules(custom: CustomBlackjackProtocol): CustomProtocolRule[] {
  return custom.rules.filter((r) => r.isEnabled && r.ruleType === 'social');
}

export function listCustomRuleReminders(custom: CustomBlackjackProtocol): string[] {
  const msgs: string[] = [];
  if (custom.protocolSpecificMessages.customRuleReminder) {
    msgs.push(custom.protocolSpecificMessages.customRuleReminder);
  }
  for (const rule of listEnabledSocialRules(custom)) {
    msgs.push(`Social rule: ${rule.title}`);
  }
  for (const rule of custom.rules.filter(
    (r) => r.isEnabled && r.ruleType === 'executable' && r.notYetExecutable,
  )) {
    msgs.push(`Custom rule (not yet executable): ${rule.title}`);
  }
  return msgs;
}
