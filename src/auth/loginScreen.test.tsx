import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginScreen } from '../screens/LoginScreen';

describe('LoginScreen', () => {
  it('renders email input when unauthenticated', () => {
    const html = renderToStaticMarkup(<LoginScreen />);
    expect(html).toContain('type="email"');
    expect(html).toContain('Send magic link');
    expect(html).toContain('SXMCARDS');
  });

  it('does not show session failure warning for normal unauthenticated state', () => {
    const html = renderToStaticMarkup(<LoginScreen sessionWarning={null} />);
    expect(html).not.toContain('Session check failed');
    expect(html).not.toContain('Could not reach the server');
  });

  it('shows invited table context on login when preview available', () => {
    const html = renderToStaticMarkup(
      <LoginScreen invitedEmail="guest@example.com" inviteTableName="Friday Night" />,
    );
    expect(html).toContain('Friday Night');
    expect(html).toContain('guest@example.com');
  });
});
