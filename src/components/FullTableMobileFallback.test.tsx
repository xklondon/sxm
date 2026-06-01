import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FullTableMobileFallback } from './FullTableMobileFallback';

describe('FullTableMobileFallback', () => {
  it('renders the too-narrow hint and a Use Card View action', () => {
    const html = renderToStaticMarkup(
      <FullTableMobileFallback onSwitchToCardView={() => {}} />,
    );
    expect(html).toContain('too narrow for Full Table');
    expect(html).toContain('Use Card View');
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
