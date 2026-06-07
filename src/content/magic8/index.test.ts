import { describe, expect, it, vi } from 'vitest';
import { getMagic8Wisdom, listMagic8WisdomPools } from './index';

const LEGACY_ACTION_ADVICE_ANSWERS = [
  'Bank Bot looks nervous.',
  'Signs point to hit.',
  'Signs point to stand.',
  'Dealer says: maybe.',
  'Your chips believe in you.',
  'The deck says yes.',
  'Fortune says: emotionally hit.',
  'Fold now, thank me later.',
  'Double down on vibes.',
  'Signs point to hit.',
];

describe('magic8 wisdom repository', () => {
  it('does not include legacy action-advice strings in active pools', () => {
    for (const gameType of ['blackjack', 'poker', 'zilch'] as const) {
      const pools = listMagic8WisdomPools(gameType);
      const all = [...pools.global, ...pools.game, ...pools.rare];
      for (const banned of LEGACY_ACTION_ADVICE_ANSWERS) {
        expect(all).not.toContain(banned);
      }
    }
  });

  it('includes the new fortune-cookie global pack', () => {
    const { global } = listMagic8WisdomPools();
    expect(global).toContain('Fortune favours the brave.');
    expect(global).toContain('Confucius say: never ask a black 8 ball for financial advice.');
    expect(global).toContain('A little humility is cheaper.');
  });
});

describe('getMagic8Wisdom', () => {
  it('returns a non-empty string from repository pools', () => {
    const wisdom = getMagic8Wisdom({ gameType: 'blackjack' });
    expect(typeof wisdom).toBe('string');
    expect(wisdom.trim().length).toBeGreaterThan(0);
  });

  it('avoids repeating the immediately previous wisdom when alternatives exist', () => {
    const pools = listMagic8WisdomPools('blackjack');
    const all = [...pools.global, ...pools.game, ...pools.rare];
    expect(all.length).toBeGreaterThan(1);
    const previous = all[0]!;
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const next = getMagic8Wisdom({ gameType: 'blackjack', previousAnswer: previous });
    expect(next).not.toBe(previous);
    vi.restoreAllMocks();
  });

  it('uses blackjack pool when game weight wins', () => {
    const blackjackOnly = listMagic8WisdomPools('blackjack').game[0]!;
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0);
    const wisdom = getMagic8Wisdom({ gameType: 'blackjack', includeRare: false });
    expect(listMagic8WisdomPools('blackjack').game).toContain(wisdom);
    expect(wisdom).toBe(blackjackOnly);
    vi.restoreAllMocks();
  });

  it('falls back to global when game pool is unavailable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const wisdom = getMagic8Wisdom({ includeRare: false });
    expect(listMagic8WisdomPools().global).toContain(wisdom);
    vi.restoreAllMocks();
  });

  it('can draw from rare pool when includeRare is true', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0);
    const wisdom = getMagic8Wisdom({ gameType: 'blackjack', includeRare: true });
    expect(listMagic8WisdomPools().rare).toContain(wisdom);
    vi.restoreAllMocks();
  });

  it('handles empty rare pool gracefully when includeRare is false', () => {
    const wisdom = getMagic8Wisdom({ gameType: 'poker', includeRare: false });
    expect(wisdom.trim().length).toBeGreaterThan(0);
  });
});
