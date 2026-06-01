import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { runDeckEngineChecks } from './engine/deck';
import { runBlackjackSanitySuite } from './engine/blackjack';
import { runHoldemEngineChecks, runHandEvaluatorChecks } from './engine/holdem';
import { AppRoot } from './AppRoot';
import { BootErrorBoundary } from './debug/BootErrorBoundary';
import { BOOT_STAGES, installBootDiagnostics, markBootStage } from './debug/bootDiagnostics';

installBootDiagnostics();
markBootStage(BOOT_STAGES.bundle);

if (import.meta.env.DEV) {
  const deckChecks = runDeckEngineChecks();
  if (!deckChecks.passed) {
    console.warn('[deck engine checks]', deckChecks.results.filter((r) => !r.passed));
  }
  const bjChecks = runBlackjackSanitySuite();
  if (!bjChecks.passed) {
    console.warn('[blackjack sanity]', bjChecks.results.filter((r) => !r.passed));
  }
  const holdemChecks = runHoldemEngineChecks();
  if (!holdemChecks.passed) {
    console.warn('[holdem engine checks]', holdemChecks.results.filter((r) => !r.passed));
  }
  const handChecks = runHandEvaluatorChecks();
  if (!handChecks.passed) {
    console.warn('[hand evaluator checks]', handChecks.results.filter((r) => !r.startsWith('pass')));
  }
}

markBootStage(BOOT_STAGES.reactEntry);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootErrorBoundary>
      <AppRoot />
    </BootErrorBoundary>
  </StrictMode>,
);