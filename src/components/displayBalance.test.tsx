import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { clampAvailableForDisplay } from './displayBalance';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { ValueAndChipsBar } from './ChipStack';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import * as bankroll from '../engine/session/bankroll';

describe('clampAvailableForDisplay', () => {
  it('never returns a value below zero', () => {
    expect(clampAvailableForDisplay(-500)).toBe(0);
    expect(clampAvailableForDisplay(0)).toBe(0);
    expect(clampAvailableForDisplay(250)).toBe(250);
    expect(clampAvailableForDisplay(null)).toBeNull();
  });
});

describe('available display clamps at 0', () => {
  it('buildTableInfoDisplay floors negative available to zero', () => {
    const state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    vi.spyOn(bankroll, 'getAvailableChipsForBankrollOwner').mockReturnValue(-500);

    const info = buildTableInfoDisplay(state, ownerId);
    expect(info.playerAvailable).toBe(0);
  });

  it('ValueAndChipsBar renders clamped available', () => {
    const html = renderToStaticMarkup(
      <ValueAndChipsBar available={-500} showChips onChipClick={() => {}} minimumBet={5} />,
    );
    expect(html).toContain('>0<');
    expect(html).not.toContain('>-500<');
  });
});
