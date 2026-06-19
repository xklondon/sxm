import { describe, expect, it } from 'vitest';
import { formatInviteHostMessage } from './tableMessagingTypes';

describe('table invite message formatting', () => {
  it('formatInviteHostMessage omits empty notes', () => {
    expect(formatInviteHostMessage('')).toBe('');
    expect(formatInviteHostMessage('   ')).toBe('');
    expect(formatInviteHostMessage('Bring snacks')).toBe('Message from host:\nBring snacks');
  });
});
