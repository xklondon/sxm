import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import {
  BLACKJACK_UI_FIX_VERSION,
  logLayoutDebugSnapshot,
  readLayoutDebugComputedSnapshot,
  type LayoutDebugComputedSnapshot,
} from './blackjackLayoutDebug';
import type { GetCurrentChipTargetForBettingResult } from './localChipTargetSelection';
import '../styles/bj-layout-debug-panel.css';

export interface BlackjackLayoutDebugPanelProps {
  enabled: boolean;
  layoutRootRef: RefObject<HTMLElement | null>;
  viewRootClass: string;
  deviceView: string;
  isMobileViewport: boolean;
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
  deviceView,
  isMobileViewport,
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
    ? `${chipTargetPreview.target.kind}:${chipTargetPreview.target.kind === 'box' ? chipTargetPreview.target.boxId : chipTargetPreview.target.slotNumber} (${chipTargetPreview.source})`
    : chipTargetPreview
      ? `null (${chipTargetPreview.reason})`
      : 'n/a';

  return (
    <aside className="bj-layout-debug-panel" aria-label="Layout debug diagnostics">
      <div className="bj-layout-debug-panel__title">Layout debug · {BLACKJACK_UI_FIX_VERSION}</div>
      <dl className="bj-layout-debug-panel__list">
        <div>
          <dt>view root</dt>
          <dd>{viewRootClass}</dd>
        </div>
        <div>
          <dt>device</dt>
          <dd>
            {deviceView} · mobile={String(isMobileViewport)}
          </dd>
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
              <dt>boxes display</dt>
              <dd>
                {computed.boxesRowDisplay} / {computed.boxesRowGridTemplate}
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
          </>
        )}
      </dl>
    </aside>
  );
}
