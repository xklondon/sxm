// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginScreen } from '../screens/LoginScreen';

vi.mock('../api/client', () => ({
  requestMagicLink: vi.fn(),
}));

import { requestMagicLink } from '../api/client';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/login');
});

describe('LoginScreen', () => {
  it('renders email input when unauthenticated', () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeTruthy();
    expect(screen.getByText('SXMCARDS')).toBeTruthy();
  });

  it('does not show session failure warning for normal unauthenticated state', () => {
    render(<LoginScreen sessionWarning={null} />);
    expect(screen.queryByText(/Session check failed/i)).toBeNull();
    expect(screen.queryByText(/Could not reach the server/i)).toBeNull();
  });

  it('forwards invite returnTo into the magic-link request', async () => {
    vi.mocked(requestMagicLink).mockResolvedValueOnce({});
    window.history.replaceState(
      {},
      '',
      '/login?invitedEmail=guest%40example.com&returnTo=%2Fjoin-table%3Ftoken%3Dinvite-token',
    );
    render(<LoginScreen invitedEmail="guest@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));
    await waitFor(() => {
      expect(requestMagicLink).toHaveBeenCalledWith(
        'guest@example.com',
        true,
        '/join-table?token=invite-token',
      );
    });
  });

  it('shows invited table context on login when preview available', () => {
    render(<LoginScreen invitedEmail="guest@example.com" inviteTableName="Friday Night" />);
    expect(screen.getByText(/Friday Night/)).toBeTruthy();
    expect(screen.getByDisplayValue('guest@example.com')).toBeTruthy();
  });

  it('success state hides email input and shows done option', async () => {
    vi.mocked(requestMagicLink).mockResolvedValueOnce({});
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'player@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^email$/i)).toBeNull();
    });
    expect(screen.getByText('player@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /done/i })).toBeTruthy();
    expect(document.querySelector('[data-login-phase="sent"]')).toBeTruthy();
  });

  it('error state keeps email input for retry', async () => {
    vi.mocked(requestMagicLink).mockRejectedValueOnce(new Error('Network error'));
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'retry@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(document.querySelector('[data-login-phase="request"]')).toBeTruthy();
  });
});
