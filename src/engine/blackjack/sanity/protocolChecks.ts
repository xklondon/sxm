import {
  BLACKJACK_PROTOCOL_PRESETS,
  getBlackjackProtocolById,
  getBlackjackProtocolOrDefault,
  isSettingsMatchingProtocol,
  listBlackjackProtocolPresets,
  protocolToBlackjackSettings,
  LAS_VEGAS_PROTOCOL,
  EUROPEAN_SHOE_PROTOCOL,
  CLASSIC_HOME_PROTOCOL,
} from '../protocols';
import { setBlackjackProtocolOnState } from '../protocolState';
import { check, type SanitySuiteResult } from './types';
import { baseTestTable } from './fixtures';

export function runProtocolSanityChecks(): SanitySuiteResult {
  const results = [];

  results.push(
    check(
      'three protocol presets registered',
      listBlackjackProtocolPresets().length === 3,
      `count=${listBlackjackProtocolPresets().length}`,
    ),
  );

  for (const protocol of BLACKJACK_PROTOCOL_PRESETS) {
    results.push(
      check(
        `preset ${protocol.protocolId} has displayName and shortDescription`,
        Boolean(protocol.displayName && protocol.shortDescription && protocol.dealerDrawRule),
      ),
    );
    results.push(
      check(
        `preset ${protocol.protocolId} maps to settings`,
        isSettingsMatchingProtocol(protocolToBlackjackSettings(protocol), protocol),
      ),
    );
  }

  const vegasSettings = protocolToBlackjackSettings(LAS_VEGAS_PROTOCOL);
  results.push(
    check('Las Vegas house rules: insurance offered', vegasSettings.allowInsurance === true),
  );
  results.push(
    check('Las Vegas house rules: 3:2 naturals', vegasSettings.blackjackPayout === 1.5),
  );

  const europeanSettings = protocolToBlackjackSettings(EUROPEAN_SHOE_PROTOCOL);
  results.push(
    check('European Shoe: no insurance', europeanSettings.allowInsurance === false),
  );
  results.push(
    check('European Shoe: double after split', europeanSettings.allowDoubleAfterSplit === true),
  );
  results.push(
    check(
      'European Shoe: double restricted to 9/10/11',
      JSON.stringify(europeanSettings.doubleAllowedTotals) === JSON.stringify([9, 10, 11]),
    ),
  );

  results.push(
    check(
      'Las Vegas: double any first two cards',
      vegasSettings.doubleAllowedTotals === 'any',
    ),
  );
  results.push(
    check(
      'all presets allow repeat splits (cap 8)',
      LAS_VEGAS_PROTOCOL.split.maxSplitsPerRound >= 8 &&
        EUROPEAN_SHOE_PROTOCOL.split.maxSplitsPerRound >= 8 &&
        CLASSIC_HOME_PROTOCOL.split.maxSplitsPerRound >= 8,
    ),
  );

  const homeSettings = protocolToBlackjackSettings(CLASSIC_HOME_PROTOCOL);
  results.push(
    check('Classic Home: even-money naturals', homeSettings.blackjackPayout === 1),
  );
  results.push(
    check('Classic Home: repeat splits enabled', homeSettings.maxSplits >= 8),
  );

  results.push(
    check(
      'unknown protocol id falls back to Las Vegas',
      getBlackjackProtocolOrDefault('missing').protocolId === LAS_VEGAS_PROTOCOL.protocolId,
    ),
  );

  results.push(
    check(
      'getBlackjackProtocolById finds European Shoe',
      getBlackjackProtocolById('european-shoe')?.protocolId === 'european-shoe',
    ),
  );

  let state = baseTestTable();
  state = setBlackjackProtocolOnState(state, 'classic-home', state.tableMeta.controllerName ?? 'Alice');
  results.push(
    check(
      'setBlackjackProtocolOnState updates id and settings',
      state.blackjackProtocolId === 'classic-home' &&
        state.blackjackSettings.blackjackPayout === 1,
    ),
  );

  return { passed: results.every((r) => r.passed), results };
}
