import { runBlackjackEngineChecks } from '../validation';
import { runProtocolSanityChecks } from './protocolChecks';
import { runDealingSanityChecks } from './dealingChecks';
import { runBankrollSanityChecks } from './bankrollChecks';
import { runGameplaySanityChecks } from './gameplayChecks';
import { runBankTurnSanityChecks } from './bankTurnChecks';
import { runCustomProtocolSanityChecks } from './customProtocolChecks';
import { runAllocationSanityChecks } from './allocationChecks';
import { runTableBalanceSanityChecks } from './tableBalanceChecks';
import { runSettlementSanityChecks } from './settlementChecks';
import { runOwnerSetupSanityChecks } from './ownerSetupChecks';
import { runPhaseAssignmentSanityChecks } from './phaseAssignmentChecks';
import { runTablePeopleSanityChecks } from './tablePeopleChecks';
import { runGameplayUxSanityChecks } from './gameplayUxChecks';
import { runProtocolCorrectnessSanityChecks } from './protocolCorrectnessChecks';
import { runCardViewPhaseChecks } from './cardViewPhaseChecks';
import { mergeSuiteResults } from './types';
export { runProtocolSanityChecks } from './protocolChecks';
export { runDealingSanityChecks } from './dealingChecks';
export { runBankrollSanityChecks } from './bankrollChecks';
export { runGameplaySanityChecks } from './gameplayChecks';
export { runBankTurnSanityChecks } from './bankTurnChecks';
export { runCustomProtocolSanityChecks } from './customProtocolChecks';
export { runAllocationSanityChecks } from './allocationChecks';
export { runTableBalanceSanityChecks } from './tableBalanceChecks';
export { runSettlementSanityChecks } from './settlementChecks';
export { runOwnerSetupSanityChecks } from './ownerSetupChecks';
export { runPhaseAssignmentSanityChecks } from './phaseAssignmentChecks';
export { runTablePeopleSanityChecks } from './tablePeopleChecks';
export { runGameplayUxSanityChecks } from './gameplayUxChecks';
export { runProtocolCorrectnessSanityChecks } from './protocolCorrectnessChecks';
export { runCardViewPhaseChecks } from './cardViewPhaseChecks';
/** Full Blackjack regression + protocol sanity suite (pure engine, no DOM). */
export function runBlackjackSanitySuite() {
    const legacy = runBlackjackEngineChecks();
    const legacySuite = {
        passed: legacy.passed,
        results: legacy.results.map((r) => ({
            name: `[legacy] ${r.name}`,
            passed: r.passed,
            detail: r.detail,
        })),
    };
    return mergeSuiteResults(legacySuite, runProtocolSanityChecks(), runDealingSanityChecks(), runBankrollSanityChecks(), runAllocationSanityChecks(), runSettlementSanityChecks(), runTableBalanceSanityChecks(), runOwnerSetupSanityChecks(), runPhaseAssignmentSanityChecks(), runGameplaySanityChecks(), runBankTurnSanityChecks(), runCustomProtocolSanityChecks(), runTablePeopleSanityChecks(), runGameplayUxSanityChecks(), runProtocolCorrectnessSanityChecks(), runCardViewPhaseChecks());
}
export function formatSanityFailures(result) {
    return result.results
        .filter((r) => !r.passed)
        .map((r) => `${r.name}${r.detail ? `: ${r.detail}` : ''}`)
        .join('\n');
}
