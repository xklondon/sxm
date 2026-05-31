import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FullTableMobileFallback } from './FullTableMobileFallback';

describe('FullTableMobileFallback', () => {
  it('renders the larger-screen hint and a switch-to-card-view action', () => {
    const html = renderToStaticMarkup(
      <FullTableMobileFallback onSwitchToCardView={() => {}} />,
    );
    expect(html).toContain('Full Table is best on a larger screen.');
    expect(html).toContain('Switch to Card View');
  });

  it('renders no felt container (no empty green table)', () => {
    const html = renderToStaticMarkup(
      <FullTableMobileFallback onSwitchToCardView={() => {}} />,
    );
    expect(html).not.toContain('bj-casino__felt');
    expect(html).not.toContain('bj-casino__rail');
    expect(html).not.toContain('bj-arc');
  });
});
