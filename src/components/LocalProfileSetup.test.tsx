import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalProfileSetup } from './LocalProfileSetup';

describe('LocalProfileSetup', () => {
  it('locks email when invited online', () => {
    const html = renderToStaticMarkup(
      <LocalProfileSetup
        open
        required
        lockedEmail="guest@example.com"
        inviteTableName="Friday Night"
        onClose={() => {}}
      />,
    );
    expect(html).toContain('guest@example.com');
    expect(html).toContain('readonly');
    expect(html).toContain('Display name');
    expect(html).toContain('Friday Night');
  });
});
