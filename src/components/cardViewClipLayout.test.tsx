import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Card View — full card visibility', () => {
  const dealerCss = readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8');
  const cardCss = readFileSync(
    join(process.cwd(), 'src/components/BlackjackCardView.css'),
    'utf8',
  );

  it('hero cards fit inside the hero grid row without a low max-height clip', () => {
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toContain('--bj-card-hero-meta-reserve');
    expect(layoutCss).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*max-height:\s*var\(--bj-card-hero-card-max-height\)/,
    );
    expect(cardCss).not.toMatch(
      /\.bj-phone-view__cards-slot[\s\S]*max-height:\s*6\.75rem/,
    );
  });

  it('play stage is contained inside the hero grid row', () => {
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__stage[\s\S]*max-height:\s*none/);
    expect(cardCss).toMatch(/\.bj-phone-view__hero-stage[\s\S]*min-height:/);
  });

  it('central hero actions use stacked primary and extras rows', () => {
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toContain('.bj-card-layout__actions .bj-table-actions');
    expect(layoutCss).toContain('.bj-card-layout__boxes .bj-phone-view__mini-hand-card-stack');
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hero-center[\s\S]*align-items:\s*center|\.bj-card-layout__hero \.bj-phone-view__hero-center[\s\S]*justify-content:\s*center/);
  });

  it('hero total badge is compact via layout tokens', () => {
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toContain('--bj-card-total-font-size: 0.54rem');
    expect(layoutCss).toContain('--bj-card-total-min-height: 0.7rem');
    expect(layoutCss).toMatch(/\.bj-card-layout__hero \.bj-phone-view__total--compact[\s\S]*font-size:\s*var\(--bj-card-total-font-size\)/);
  });

  it('dealer/command header block uses compact spacing', () => {
    expect(dealerCss).toMatch(/\.dealer-block__command[\s\S]*min-height:\s*1\.85rem/);
    expect(dealerCss).toMatch(/\.dealer-block__cards-slot[\s\S]*min-height:\s*var\(--bj-dealer-cards-slot-min-height/);
  });
});
