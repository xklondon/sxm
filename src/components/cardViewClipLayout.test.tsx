import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Card View — full card visibility', () => {
  const dealerCss = readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8');
  const cardCss = readFileSync(
    join(process.cwd(), 'src/components/BlackjackCardView.css'),
    'utf8',
  );

  it('hero cards slot does not clip with a low max-height', () => {
    expect(cardCss).toMatch(/\.bj-phone-view__cards-slot[\s\S]*overflow:\s*visible/);
    expect(cardCss).not.toMatch(
      /\.bj-phone-view__cards-slot[\s\S]*max-height:\s*6\.75rem/,
    );
    expect(cardCss).toMatch(/\.bj-phone-view__hero-stage[\s\S]*overflow:\s*visible/);
  });

  it('play stage allows overflow for tall hero cards', () => {
    expect(cardCss).toMatch(/\.bj-phone-view__slot--stage[\s\S]*overflow:\s*visible/);
    expect(cardCss).toMatch(/\.bj-phone-view__stage[\s\S]*overflow:\s*visible/);
    expect(cardCss).toMatch(/\.bj-phone-view__hero-stage[\s\S]*min-height:/);
  });

  it('central hero actions use stacked primary and extras rows', () => {
    expect(cardCss).toContain('.bj-phone-view__action-bar--playing');
    expect(cardCss).toContain('.bj-phone-view__mini-hand-card-stack');
    expect(cardCss).toMatch(/\.bj-phone-view__hero-center[\s\S]*align-items:\s*center/);
  });

  it('hero total badge is compact', () => {
    expect(cardCss).toMatch(/\.bj-phone-view__total--hero[\s\S]*min-height:\s*1\.25rem/);
    expect(cardCss).toMatch(/\.bj-phone-view__total--hero[\s\S]*font-size:\s*0\.68rem/);
  });

  it('dealer/command header block uses compact spacing', () => {
    expect(dealerCss).toMatch(/\.dealer-block__command[\s\S]*min-height:\s*1\.85rem/);
    expect(dealerCss).toMatch(/\.dealer-block__cards-slot[\s\S]*min-height:\s*2\.65rem/);
  });
});
