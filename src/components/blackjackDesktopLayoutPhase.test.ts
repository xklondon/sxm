import { describe, expect, it } from 'vitest';
import { getBlackjackDesktopLayoutPhase } from './blackjackDesktopLayoutPhase';

describe('getBlackjackDesktopLayoutPhase', () => {
  it('maps betting protocol phase', () => {
    expect(getBlackjackDesktopLayoutPhase('betting', false)).toBe('betting');
  });

  it('maps player and bank to playing', () => {
    expect(getBlackjackDesktopLayoutPhase('player', false)).toBe('playing');
    expect(getBlackjackDesktopLayoutPhase('bank', false)).toBe('playing');
  });

  it('maps dealing and insurance to dealing', () => {
    expect(getBlackjackDesktopLayoutPhase('dealing', false)).toBe('dealing');
    expect(getBlackjackDesktopLayoutPhase('insurance', false)).toBe('dealing');
  });

  it('maps resolved states', () => {
    expect(getBlackjackDesktopLayoutPhase('round-complete', false)).toBe('resolved');
    expect(getBlackjackDesktopLayoutPhase('banking', false)).toBe('resolved');
    expect(getBlackjackDesktopLayoutPhase('player', true)).toBe('resolved');
  });
});
