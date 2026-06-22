import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import {
  BLACKJACK_CSS_LAYOUT_ROUTE_VERSION,
  BLACKJACK_TABLE_LAYOUT_SHELL_NAME,
  BLACKJACK_UI_FIX_VERSION,
  TABLE_LAYOUT_ENGINE_VERSION,
  formatBlackjackCssImportRoute,
  formatBlackjackShellZoneOrder,
  logLayoutDebugSnapshot,
  readLayoutDebugComputedSnapshot,
  resolveLayoutModeFromStrings,
  type LayoutDebugComputedSnapshot,
} from './blackjackLayoutDebug';
import type { GetCurrentChipTargetForBettingResult } from './localChipTargetSelection';
import '../styles/bj-layout-debug-panel.css';

export interface BlackjackLayoutDebugPanelProps {
  enabled: boolean;
  layoutRootRef: RefObject<HTMLElement | null>;
  viewRootClass: string;
  viewMode: string;
  deviceView: string;
  isMobileViewport: boolean;
  protocolPhase: string;
  uiProtocolPhase?: string;
  cardRevealComplete?: boolean;
  commandMessage?: string | null;
  commandMessageSource?: string;
  boxRevealDiagnostics?: string;
  desktopLayoutPhase?: string;
  visibleBoxCount: number;
  selectedBettingBoxId: string | null;
  selectedBettingSlotNumber: number | null;
  chipTargetPreview: GetCurrentChipTargetForBettingResult | null;
  trayComponentLabel: string;
}

export function BlackjackLayoutDebugPanel({
  enabled,
  layoutRootRef,
  viewRootClass,
  viewMode,
  deviceView,
  isMobileViewport,
  protocolPhase,
  uiProtocolPhase,
  cardRevealComplete,
  commandMessage,
  commandMessageSource,
  boxRevealDiagnostics,
  desktopLayoutPhase,
  visibleBoxCount,
  selectedBettingBoxId,
  selectedBettingSlotNumber,
  chipTargetPreview,
  trayComponentLabel,
}: BlackjackLayoutDebugPanelProps) {
  const [computed, setComputed] = useState<LayoutDebugComputedSnapshot | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setComputed(null);
      return;
    }
    const snapshot = readLayoutDebugComputedSnapshot(layoutRootRef.current);
    setComputed(snapshot);
    if (snapshot) {
      logLayoutDebugSnapshot(snapshot);
    }
  }, [
    enabled,
    layoutRootRef,
    viewRootClass,
    deviceView,
    visibleBoxCount,
    selectedBettingBoxId,
    chipTargetPreview,
  ]);

  if (!enabled) {
    return null;
  }

  const targetLine = chipTargetPreview?.ok
    ? `slot:${chipTargetPreview.slotNumber} (${chipTargetPreview.source})`
    : chipTargetPreview
      ? `null (${chipTargetPreview.reason})`
      : 'n/a';

  const layoutMode = computed?.layoutMode ?? resolveLayoutModeFromStrings(deviceView, viewMode);

  return (
    <aside className="bj-layout-debug-panel" aria-label="Layout debug diagnostics">
      <div className="bj-layout-debug-panel__title">Layout debug · {TABLE_LAYOUT_ENGINE_VERSION}</div>
      <dl className="bj-layout-debug-panel__list">
        <div>
          <dt>engine version</dt>
          <dd>{TABLE_LAYOUT_ENGINE_VERSION}</dd>
        </div>
        <div>
          <dt>layout version</dt>
          <dd>{BLACKJACK_UI_FIX_VERSION}</dd>
        </div>
        <div>
          <dt>mode</dt>
          <dd>{layoutMode}</dd>
        </div>
        <div>
          <dt>shell</dt>
          <dd>{BLACKJACK_TABLE_LAYOUT_SHELL_NAME}</dd>
        </div>
        <div>
          <dt>view mode</dt>
          <dd>
            {viewMode} · {viewRootClass}
          </dd>
        </div>
        <div>
          <dt>device</dt>
          <dd>
            {deviceView} · mobile={String(isMobileViewport)}
          </dd>
        </div>
        <div>
          <dt>phase</dt>
          <dd>
            {protocolPhase}
            {uiProtocolPhase && uiProtocolPhase !== protocolPhase
              ? ` · ui=${uiProtocolPhase}`
              : ''}
            {desktopLayoutPhase ? ` · data-bj-phase=${desktopLayoutPhase}` : ''}
          </dd>
        </div>
        {cardRevealComplete !== undefined && (
          <div>
            <dt>reveal complete</dt>
            <dd>{String(cardRevealComplete)}</dd>
          </div>
        )}
        {commandMessage !== undefined && (
          <div>
            <dt>command message</dt>
            <dd>{commandMessage ?? '(null)'}</dd>
          </div>
        )}
        {commandMessageSource && (
          <div>
            <dt>command source</dt>
            <dd>{commandMessageSource}</dd>
          </div>
        )}
        {boxRevealDiagnostics && (
          <div>
            <dt>box results (game vs UI)</dt>
            <dd>{boxRevealDiagnostics}</dd>
          </div>
        )}
        <div>
          <dt>CSS route</dt>
          <dd>{formatBlackjackCssImportRoute()}</dd>
        </div>
        <div>
          <dt>CSS version</dt>
          <dd>{BLACKJACK_CSS_LAYOUT_ROUTE_VERSION}</dd>
        </div>
        <div>
          <dt>zone order</dt>
          <dd>{formatBlackjackShellZoneOrder()}</dd>
        </div>
        <div>
          <dt>visibleBoxCount</dt>
          <dd>{visibleBoxCount}</dd>
        </div>
        <div>
          <dt>selectedBettingBoxId</dt>
          <dd>{selectedBettingBoxId ?? 'null'}</dd>
        </div>
        <div>
          <dt>selectedBettingSlotNumber</dt>
          <dd>{selectedBettingSlotNumber ?? 'null'}</dd>
        </div>
        <div>
          <dt>chip target</dt>
          <dd>{targetLine}</dd>
        </div>
        <div>
          <dt>tray</dt>
          <dd>{trayComponentLabel}</dd>
        </div>
        {computed && (
          <>
            <div>
              <dt>shell display</dt>
              <dd>{computed.shellDisplay}</dd>
            </div>
            <div>
              <dt>shell grid rows</dt>
              <dd>{computed.shellGridRows}</dd>
            </div>
            {computed.zoneDiagnostics.map((zone) => (
              <div key={zone.zone}>
                <dt>
                  zone · {zone.zone}
                  {zone.present ? '' : ' (missing)'}
                </dt>
                <dd>
                  {zone.bounds} · {zone.renderedComponent}
                  <br />
                  owner: {zone.cssOwner}
                </dd>
              </div>
            ))}
            <div>
              <dt>boxes display</dt>
              <dd>
                {computed.boxesRowDisplay} / {computed.boxesRowGridTemplate}
              </dd>
            </div>
            <div>
              <dt>add box</dt>
              <dd>
                {computed.addBoxWidth} × {computed.addBoxHeight}
              </dd>
            </div>
            <div>
              <dt>first box</dt>
              <dd>
                {computed.firstBoxWidth} × {computed.firstBoxHeight}
              </dd>
            </div>
            <div>
              <dt>boxes gap</dt>
              <dd>{computed.boxesGap}</dd>
            </div>
            <div>
              <dt>boxes overflow</dt>
              <dd>
                {computed.boxesZoneOverflowX}/{computed.boxesZoneOverflowY}
              </dd>
            </div>
            <div>
              <dt>tray CSS</dt>
              <dd>
                {computed.trayPosition} · {computed.trayDisplay} · h={computed.trayHeight} · pb=
                {computed.trayPaddingBottom}
              </dd>
            </div>
            <div>
              <dt>canvas height</dt>
              <dd>{computed.canvasHeight}</dd>
            </div>
            <div>
              <dt>DOM order</dt>
              <dd>{computed.playerBoxDomOrder}</dd>
            </div>
            <div>
              <dt>row bounds</dt>
              <dd>{computed.playerRowBounds}</dd>
            </div>
            <div>
              <dt>tray bounds</dt>
              <dd>{computed.trayBounds}</dd>
            </div>
            <div>
              <dt>tray overlap</dt>
              <dd>{String(computed.trayOverlapsPlayerRow)}</dd>
            </div>
            <div>
              <dt>tray overflow chain</dt>
              <dd>{computed.trayOverflowChain}</dd>
            </div>
            <div>
              <dt>card placement</dt>
              <dd>{computed.cardPlacementContract}</dd>
            </div>
            <div>
              <dt>cards zone bounds</dt>
              <dd>{computed.cardsZoneBounds}</dd>
            </div>
            <div>
              <dt>command bounds</dt>
              <dd>{computed.commandZoneBounds}</dd>
            </div>
            <div>
              <dt>box amount bounds</dt>
              <dd>{computed.boxAmountBounds}</dd>
            </div>
            <div>
              <dt>hero cards bounds</dt>
              <dd>{computed.heroCardsBounds}</dd>
            </div>
            <div>
              <dt>cards zone overflow</dt>
              <dd>{computed.cardsZoneOverflow}</dd>
            </div>
            <div>
              <dt>card stack bounds</dt>
              <dd>{computed.cardStackBounds}</dd>
            </div>
            <div>
              <dt>overlap warnings</dt>
              <dd>
                {computed.overlapWarnings.length
                  ? computed.overlapWarnings.join(', ')
                  : 'none'}
              </dd>
            </div>
          </>
        )}
      </dl>
    </aside>
  );
}
