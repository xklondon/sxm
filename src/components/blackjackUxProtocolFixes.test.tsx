import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { AceDecisionButtonRow, ACE_DECISION_BTN_CLASS } from './blackjackAceDecisionActions';
import { resolveShowRoundSummaryOverlay } from '../types/table';
import { createNewBlackjackTable } from '../engine/session';
import {
  getBlackjackProtocolPhase,
  shuffleToStartOnState,
  startNextRoundOnState,
} from '../engine/blackjack';
import { applyShortStackMinBetTopUpOnState } from '../engine/blackjack/shortStackTopUp';
import {
  isInsuranceBoxDecisionResolved,
  shouldOfferInsurance,
} from '../engine/blackjack/insurance';
import { shouldOfferEvenMoney } from '../engine/blackjack/protocols/activeRules';
import { getBlackjackProtocolOrDefault } from '../engine/blackjack/protocols';
import { getCardById } from '../engine/deck';
import { getBlackjackHandValue, cardsFromIds } from '../engine/blackjack/hand';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey } from '../engine/blackjack';
import { getAvailableChipsForBankrollOwner } from '../engine/session/bankroll';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { buildRoundSummaryOverlayModel } from '../engine/blackjack/roundSummaryOverlay';
import { RoundSummaryOverlay } from './RoundSummaryOverlay';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const noop = () => {};

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const MASTER_SPEC = readFileSync(join(process.cwd(), 'docs/SXM_MASTER_SPEC.md'), 'utf8');
const CHANGE_LOG = readFileSync(join(process.cwd(), 'docs/CHANGE_LOG.md'), 'utf8');

describe('blackjack UX protocol fixes — card column values', () => {
  it('renders hand value below card columns in Table View', () => {
    expect(PANEL_SRC).toContain('resolvePrimaryHandValueLabel');
    expect(PANEL_SRC).toContain('TABLE_UX.cardColumnValueBelow');
    expect(PANEL_SRC).toMatch(/renderArcCardColumn[\s\S]*cardColumnHandValueClassName/);
  });
});

describe('blackjack UX protocol fixes — box stability', () => {
  it('matches + add-box outer sizing to player boxes', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row__add[\s\S]*width:\s*100%/,
    );
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row__add[\s\S]*background:\s*transparent/);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row__add::after[\s\S]*aspect-ratio:\s*1\.05 \/ 1/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes > \.bj-arc__slot--owned[\s\S]*align-self:\s*stretch/,
    );
  });

  it('uses box-shadow-only turn pulse without layout-affecting border changes', () => {
    expect(SHARED_CSS).toMatch(/@keyframes bj-turn-pulse[\s\S]*inset 0 0 0 1px/);
    expect(SHARED_CSS).not.toMatch(
      /@keyframes bj-turn-pulse[\s\S]*inset 0 0 0 2px var\(--bj-seat-active-border\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-phone-view__mini-stake-slot[\s\S]*height:\s*var\(--bj-full-table-stake-min-height/,
    );
  });
});

describe('blackjack UX protocol fixes — insurance and even money', () => {
  it('offers insurance when dealer up-card is Ace after full deal', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const aceId = findCardId(state.deck!, 'A');
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')], 50),
        insuranceOfferPending: true,
        dealerCardIds: [aceId, findCardId(state.deck!, '5')],
        activeHandKey: null,
        status: 'player-turns',
      },
    };
    expect(shouldOfferInsurance(state.blackjack!, state.deck!, state.blackjackSettings)).toBe(true);
    expect(getBlackjackProtocolPhase(state)).toBe('insurance');
  });

  it('does not auto-resolve insurance when player cannot afford premium', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const aceId = findCardId(state.deck!, 'A');
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')], 50),
        insuranceOfferPending: true,
        dealerCardIds: [aceId, findCardId(state.deck!, '5')],
        activeHandKey: null,
      },
    };
    const protocol = getBlackjackProtocolOrDefault();
    expect(
      isInsuranceBoxDecisionResolved(state, state.blackjack!, protocol, boxId),
    ).toBe(false);
  });

  it('offers even money only for clean natural blackjack vs Ace', () => {
    const deck = tableWithClaimedBox(1).deck!;
    const ace = getCardById(deck, findCardId(deck, 'A'))!;
    const king = getCardById(deck, findCardId(deck, 'K'))!;
    const protocol = getBlackjackProtocolOrDefault();
    expect(shouldOfferEvenMoney(protocol, [ace, king], 'A')).toBe(true);
    const thirteen = cardsFromIds(deck, [findCardId(deck, '6'), findCardId(deck, '7')]);
    expect(shouldOfferEvenMoney(protocol, thirteen, 'A')).toBe(false);
    expect(getBlackjackHandValue(thirteen).isBlackjack).toBe(false);
  });

  it('uses Play vs Ace label and thin yellow ace-decision buttons', () => {
    expect(PANEL_SRC).toContain('Play vs Ace');
    expect(PANEL_SRC).not.toContain('Wait for 3:2');
    expect(PANEL_SRC).toContain('AceDecisionButtonRow');
    const html = renderToStaticMarkup(
      <AceDecisionButtonRow
        primaryLabel="Take 1:1"
        secondaryLabel="Play vs Ace"
        onPrimary={noop}
        onSecondary={noop}
      />,
    );
    expect(html).toContain('Take 1:1');
    expect(html).toContain('Play vs Ace');
    expect(html).toContain(ACE_DECISION_BTN_CLASS);
    expect(SHARED_CSS).toMatch(/\.bj-table-actions__btn--ace[\s\S]*border:\s*1px solid rgb\(251 191 36/);
  });
});

describe('blackjack UX protocol fixes — Card View mobile hero', () => {
  it('uses smaller hero clamps and prevents horizontal overflow with extra cards', () => {
    expect(CARD_LAYOUT_CSS).toMatch(/--bj-card-hero-card-width:\s*clamp\(4\.5rem, 30vw, 7\.5rem\)/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-phone-view__cards[\s\S]*overflow:\s*hidden/);
    expect(CARD_LAYOUT_CSS).toMatch(/margin-left:\s*-28%/);
  });
});

describe('blackjack UX protocol fixes — summary screen', () => {
  it('defaults summary overlay to off unless explicitly enabled', () => {
    const state = createNewBlackjackTable();
    expect(resolveShowRoundSummaryOverlay(state.tableMeta)).toBe(false);
  });

  it('shows visual cards and won/lost chip wording when opened', () => {
    let state = tableWithClaimedBox(1);
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const k1 = blackjackHandKey(box1, 0);
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'resolved',
        isSettled: true,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
        playerHands: {
          [k1]: {
            ...createBlackjackPlayerHand(box1, 0),
            cardIds: [findCardId(deck, '8'), findCardId(deck, '7')],
            currentBet: 10,
          },
        },
        outcomes: { [k1]: 'win' },
      },
    };
    const model = buildRoundSummaryOverlayModel(state)!;
    const html = renderToStaticMarkup(
      <RoundSummaryOverlay open model={model} deck={deck} onPlayOn={noop} onClose={noop} />,
    );
    expect(html).toContain('playing-card');
    expect(html).toContain('Won 10c');
    expect(html).toContain('Players net');
  });
});

describe('blackjack UX protocol fixes — short-stack min-bet top-up', () => {
  it('tops up short stack to min bet at next betting round (e.g. 3 → 5)', () => {
    let state = tableWithClaimedBox(1);
    const ownerId = state.tableMeta.ownerPersonId!;
    const before = getAvailableChipsForBankrollOwner(state, ownerId);
    expect(before).toBeGreaterThan(0);
    const minBet = before + 2;
    const topped = applyShortStackMinBetTopUpOnState({
      ...state,
      tableMeta: { ...state.tableMeta, minimumBet: minBet },
    });
    expect(getAvailableChipsForBankrollOwner(topped, ownerId)).toBe(minBet);

    state = {
      ...topped,
      tableMeta: { ...topped.tableMeta, awaitingNextRound: true, shoeStarted: true },
      blackjack: topped.blackjack
        ? { ...topped.blackjack, status: 'resolved' as const, isSettled: true }
        : topped.blackjack,
    };
    if (!state.deck) {
      state = shuffleToStartOnState(state);
    }
    const next = startNextRoundOnState(state);
    expect(getAvailableChipsForBankrollOwner(next, ownerId)).toBeGreaterThanOrEqual(minBet);
  });

  it('does not top up bankrupt players with zero chips', () => {
    const state = createNewBlackjackTable();
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(getAvailableChipsForBankrollOwner(state, ownerId)).toBe(0);
    const topped = applyShortStackMinBetTopUpOnState(state);
    expect(getAvailableChipsForBankrollOwner(topped, ownerId)).toBe(0);
  });
});

describe('blackjack UX protocol fixes — shared felt tokens', () => {
  it('uses table felt background token in Card View mobile hero panel', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*background:\s*var\(--bj-table-felt-bg\)/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*rgb\(8 28 22/,
    );
  });
});

describe('blackjack UX protocol fixes — documentation', () => {
  it('documents protocol and layout rules in master spec and changelog', () => {
    expect(MASTER_SPEC).toContain('play zone');
    expect(MASTER_SPEC).toContain('Short-stack min-bet top-up');
    expect(MASTER_SPEC).toContain('Play vs Ace');
    expect(MASTER_SPEC).toContain('Summary screen');
    expect(CHANGE_LOG).toContain('Blackjack UX/protocol');
  });
});
