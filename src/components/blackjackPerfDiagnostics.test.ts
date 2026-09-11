import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { beginBlackjackPerfTrace } from './blackjackPerfDiagnostics';

const SOURCE = readFileSync(
  join(process.cwd(), 'src/components/blackjackPerfDiagnostics.ts'),
  'utf8',
);
const PANEL_SOURCE = readFileSync(
  join(process.cwd(), 'src/components/BlackjackPanel.tsx'),
  'utf8',
);
const ONLINE_SOURCE = readFileSync(
  join(process.cwd(), 'src/hooks/useOnlineMultiplayer.ts'),
  'utf8',
);

describe('blackjack performance diagnostics', () => {
  it('is development-only and reports the canonical latency fields', () => {
    expect(SOURCE).toContain("import.meta.env?.DEV === true");
    expect(SOURCE).toContain("VITE_BLACKJACK_PERF === 'true'");
    for (const field of [
      'action=',
      'tapToHandler=',
      'handlerToState=',
      'stateToRender=',
      'serverRoundTrip=',
      'total=',
    ]) {
      expect(SOURCE).toContain(field);
    }
    expect(PANEL_SOURCE).toContain('beginBlackjackPerfTrace');
    expect(ONLINE_SOURCE).toContain("beginBlackjackPerfTrace(type, { serverRoundTrip: true })");
  });

  it('does not log in the test/production-disabled path', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const trace = beginBlackjackPerfTrace('hit');
    trace.markStateApplied();
    trace.finish();
    expect(debug).not.toHaveBeenCalled();
    debug.mockRestore();
  });
});
