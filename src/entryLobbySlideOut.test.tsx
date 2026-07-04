// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { EntryLobbyScreen } from './screens/EntryLobbyScreen';
import { ActiveTablesList } from './components/ActiveTablesList';
import { LoadTableList } from './components/LoadTableList';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';
import type { ActiveTableSummary } from './types/activeTables';

const VALID_TABLE = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

vi.mock('./api/config', () => ({
  isOnlineModeEnabled: () => true,
  apiPath: (path: string) => path,
  getSocketBaseUrl: () => 'http://127.0.0.1:3017',
}));

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    connected: false,
    active: true,
    io: { on: vi.fn(), removeAllListeners: vi.fn() },
  }),
}));

vi.mock('./storage/settingsStorage', () => ({
  loadSettings: () => ({}),
}));

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Tester', email: 'tester@example.com' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: vi.fn(),
  getStoredViewerPersonIdForTable: () => null,
}));

vi.mock('./design/templates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./design/templates')>();
  return {
    ...actual,
    applyDesignTemplateToDocument: vi.fn(),
  };
});

const {
  createOnlineTableMock,
  fetchTableMock,
  fetchActiveTablesMock,
  fetchMyTablesMock,
  requestTableAccessMock,
  sendTableActionMock,
  joinOnlineTableMock,
} = vi.hoisted(() => ({
  createOnlineTableMock: vi.fn(),
  fetchTableMock: vi.fn(),
  fetchActiveTablesMock: vi.fn(),
  fetchMyTablesMock: vi.fn(),
  requestTableAccessMock: vi.fn(),
  sendTableActionMock: vi.fn(),
  joinOnlineTableMock: vi.fn(),
}));

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    createOnlineTable: createOnlineTableMock,
    fetchTable: fetchTableMock,
    fetchActiveTables: fetchActiveTablesMock,
    fetchMyTables: fetchMyTablesMock,
    requestTableAccess: requestTableAccessMock,
    sendTableAction: sendTableActionMock,
    joinOnlineTable: joinOnlineTableMock,
    logout: vi.fn(),
  };
});

const rootUser = {
  userId: 'user-1',
  email: 'root@example.com',
  displayName: 'Root',
  canOwnTables: true,
  isRoot: true,
};

function activeTable(overrides: Partial<ActiveTableSummary> = {}): ActiveTableSummary {
  return {
    tableId: VALID_TABLE,
    name: 'Friday Night',
    game: 'blackjack',
    mode: 'practice',
    wager: null,
    players: ['host@example.com'],
    bank: 'Dealer',
    host: 'Host',
    hostEmail: 'host@example.com',
    playerCount: 2,
    status: 'active',
    createdAt: '2026-06-01T12:00:00.000Z',
    access: 'request',
    ...overrides,
  };
}

describe('entry lobby boot flow', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    createOnlineTableMock.mockClear();
    fetchTableMock.mockClear();
    fetchActiveTablesMock.mockResolvedValue([]);
    fetchMyTablesMock.mockResolvedValue([]);
  });

  it('shows Entry Lobby when stored table id exists but no URL table param', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, VALID_TABLE);
    render(<App user={rootUser} onlineMode bootTableId={null} />);
    await waitFor(() => {
      expect(screen.getByText('Open New Table')).toBeTruthy();
      expect(screen.getByText('Join a Table')).toBeTruthy();
      expect(screen.getByText('Load a Table')).toBeTruthy();
    });
    expect(fetchTableMock).not.toHaveBeenCalled();
    expect(createOnlineTableMock).not.toHaveBeenCalled();
  });

  it('loads table when bootTableId comes from invite URL param', async () => {
    const { createNewBlackjackTable } = await import('./engine/session');
    fetchTableMock.mockResolvedValue({
      tableId: VALID_TABLE,
      version: 1,
      state: createNewBlackjackTable(),
      memberPersonId: 'p1',
    });
    render(<App user={rootUser} onlineMode bootTableId={VALID_TABLE} />);
    await waitFor(() => {
      expect(fetchTableMock).toHaveBeenCalledWith(VALID_TABLE);
    });
  });
});

function openNewTableSetup() {
  fireEvent.click(screen.getByRole('button', { name: 'Open New Table' }));
  expect(screen.getByRole('dialog', { name: 'Open New Table' })).toBeTruthy();
  expect(document.querySelector('.new-table-overlay__panel, .sxm-modal-shell__backdrop')).toBeTruthy();
}

function openNewTableToBlackjackMode() {
  openNewTableSetup();
  fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
  fireEvent.click(screen.getByRole('button', { name: 'Blackjack' }));
}

describe('entry lobby slide-outs', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchActiveTablesMock.mockResolvedValue([]);
    fetchMyTablesMock.mockResolvedValue([]);
    requestTableAccessMock.mockResolvedValue({ requestId: 'req-1' });
    createOnlineTableMock.mockClear();
  });

  it('Open New Table opens slide-out instead of creating table immediately', async () => {
    render(
      <EntryLobbyScreen
        onConfirmNewTable={vi.fn()}
        onOpenTable={vi.fn()}
        onLoadEntry={vi.fn()}
        onlineMode
        canOwnTables
      />,
    );
    openNewTableSetup();
    expect(screen.getByText('Game category')).toBeTruthy();
    expect(createOnlineTableMock).not.toHaveBeenCalled();
  });

  it('selecting Blackjack shows Practice and Challenge modes', async () => {
    render(
      <EntryLobbyScreen
        onConfirmNewTable={vi.fn()}
        onOpenTable={vi.fn()}
        onLoadEntry={vi.fn()}
        onlineMode={false}
        canOwnTables
      />,
    );
    openNewTableToBlackjackMode();
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Challenge')).toBeTruthy();
  });

  it('Practice hides wager and invite fields and starts table', async () => {
    const onConfirmNewTable = vi.fn();
    render(
      <EntryLobbyScreen
        onConfirmNewTable={onConfirmNewTable}
        onOpenTable={vi.fn()}
        onLoadEntry={vi.fn()}
        onlineMode={false}
        canOwnTables
      />,
    );
    openNewTableToBlackjackMode();
    fireEvent.click(screen.getByRole('button', { name: /Practice/i }));
    expect(screen.queryByText('Play for what')).toBeNull();
    expect(screen.queryByText(/invite by email/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Table' }));
    await waitFor(() => {
      expect(onConfirmNewTable).toHaveBeenCalledWith(
        expect.objectContaining({ tableMode: 'practice', bankerMode: 'bot' }),
      );
    });
  });

  it('Challenge shows wager, invite, bank fields and validates required inputs', async () => {
    render(
      <EntryLobbyScreen
        onConfirmNewTable={vi.fn()}
        onOpenTable={vi.fn()}
        onLoadEntry={vi.fn()}
        onlineMode={false}
        canOwnTables
      />,
    );
    openNewTableToBlackjackMode();
    fireEvent.click(screen.getByRole('button', { name: /Challenge/i }));
    expect(screen.getByText('Play for what')).toBeTruthy();
    expect(screen.getByText(/invite by email/i)).toBeTruthy();
    expect(screen.getByText('Who is the bank?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Table' }));
    expect(await screen.findByText('Enter what you are playing for.')).toBeTruthy();
  });

  it('Join Table opens active table slide-out', async () => {
    fetchActiveTablesMock.mockResolvedValue([activeTable()]);
    render(
      <EntryLobbyScreen
        onConfirmNewTable={vi.fn()}
        onOpenTable={vi.fn()}
        onLoadEntry={vi.fn()}
        onlineMode
        canOwnTables
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join a Table' }));
    expect(screen.getByRole('dialog', { name: 'Join a Table' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Friday Night')).toBeTruthy();
    });
  });

  it('member table shows Join action', async () => {
    fetchActiveTablesMock.mockResolvedValue([activeTable({ access: 'open' })]);
    render(<ActiveTablesList onOpenTable={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
    });
  });

  it('non-invited table shows Knock and calls request-access', async () => {
    fetchActiveTablesMock.mockResolvedValue([activeTable({ access: 'request' })]);
    render(<ActiveTablesList onOpenTable={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Knock' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Knock' }));
    await waitFor(() => {
      expect(requestTableAccessMock).toHaveBeenCalledWith(VALID_TABLE, 'Tester');
    });
  });

  it('pending knock shows Pending and disables action', async () => {
    fetchActiveTablesMock.mockResolvedValue([activeTable({ access: 'pending' })]);
    render(<ActiveTablesList onOpenTable={vi.fn()} />);
    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Pending' });
      expect(button).toBeTruthy();
      expect(button).toHaveProperty('disabled', true);
    });
  });

  it('Load Table opens saved table slide-out with expandable details and ReOpen', async () => {
    fetchMyTablesMock.mockResolvedValue([
      activeTable({ access: 'open', name: 'My Saved Table' }),
    ]);
    const onLoadEntry = vi.fn();
    render(
      <EntryLobbyScreen
        onConfirmNewTable={vi.fn()}
        onOpenTable={vi.fn()}
        onLoadEntry={onLoadEntry}
        onlineMode
        canOwnTables
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load a Table' }));
    expect(screen.getByRole('dialog', { name: 'Load a Table' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('My Saved Table')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('My Saved Table'));
    fireEvent.click(screen.getByRole('button', { name: 'ReOpen' }));
    expect(onLoadEntry).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: VALID_TABLE, source: 'online' }),
    );
  });

  it('LoadTableList requires ReOpen instead of loading on row click', async () => {
    fetchMyTablesMock.mockResolvedValue([
      activeTable({ access: 'open', name: 'Explicit Load' }),
    ]);
    const onLoad = vi.fn();
    render(<LoadTableList onlineMode onLoad={onLoad} />);
    await waitFor(() => {
      expect(screen.getByText('Explicit Load')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Explicit Load'));
    expect(onLoad).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ReOpen' }));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('Open New Table does not auto-create when clicked from App lobby', async () => {
    render(<App user={rootUser} onlineMode bootTableId={null} />);
    await waitFor(() => {
      expect(screen.getByText('Open New Table')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open New Table' }));
    expect(createOnlineTableMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Open New Table' })).toBeTruthy();
    expect(document.querySelector('.new-table-overlay__panel, .sxm-modal-shell__backdrop')).toBeTruthy();
  });
});
