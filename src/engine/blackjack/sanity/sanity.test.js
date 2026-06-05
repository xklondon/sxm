import { describe, expect, it } from 'vitest';
import { runBankrollSanityChecks, runDealingSanityChecks, runGameplaySanityChecks, runProtocolSanityChecks, runAllocationSanityChecks, runSettlementSanityChecks, runTableBalanceSanityChecks, runOwnerSetupSanityChecks, runPhaseAssignmentSanityChecks, runGameplayUxSanityChecks, runProtocolCorrectnessSanityChecks, runCardViewPhaseChecks, runBlackjackSanitySuite, formatSanityFailures, } from './index';
describe('Blackjack protocol sanity', () => {
    it('passes protocol preset checks', () => {
        const result = runProtocolSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Blackjack dealing sanity', () => {
    it('passes deal order checks', () => {
        const result = runDealingSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Blackjack bankroll sanity', () => {
    it('passes bankroll accounting checks', () => {
        const result = runBankrollSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Blackjack gameplay sanity', () => {
    it('passes split/double/payout/insurance checks', () => {
        const result = runGameplaySanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Chip allocation sanity', () => {
    it('passes canonical allocation checks', () => {
        const result = runAllocationSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Settlement sanity', () => {
    it('passes settlement and balance checks', () => {
        const result = runSettlementSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Table balance sanity', () => {
    it('passes balance display and game end checks', () => {
        const result = runTableBalanceSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Owner setup sanity', () => {
    it('passes owner bankroll and starting chips checks', () => {
        const result = runOwnerSetupSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Phase assignment sanity', () => {
    it('passes deal eligibility and caller assignment checks', () => {
        const result = runPhaseAssignmentSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Gameplay UX sanity (Phase 32)', () => {
    it('passes chip removal, double, auto-stand, bust, and score ledger checks', () => {
        const result = runGameplayUxSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Protocol correctness sanity (Phase 33)', () => {
    it('passes activeRules, bust, natural, and flow checks', () => {
        const result = runProtocolCorrectnessSanityChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Card View phase sanity', () => {
    it('passes shared phase selectors and card view flows', () => {
        const result = runCardViewPhaseChecks();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
describe('Blackjack full sanity suite', () => {
    it('passes all engine checks', () => {
        const result = runBlackjackSanitySuite();
        expect(result.passed, formatSanityFailures(result)).toBe(true);
    });
});
