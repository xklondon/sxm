// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewTableOverlay } from './NewTableOverlay';

describe('NewTableOverlay discard guard', () => {
  afterEach(() => {
    cleanup();
  });
  it('closes immediately when setup is not dirty', () => {
    const onClose = vi.fn();
    render(
      <NewTableOverlay
        open
        title="New Table"
        ariaLabel="New table setup"
        confirmDiscardWhenDirty={false}
        onClose={onClose}
      >
        <p>Setup</p>
      </NewTableOverlay>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Close New Table/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard new table setup?')).toBeNull();
  });

  it('requires confirmation before closing dirty setup', () => {
    const onClose = vi.fn();
    render(
      <NewTableOverlay
        open
        title="New Table"
        ariaLabel="New table setup"
        confirmDiscardWhenDirty
        onClose={onClose}
      >
        <p>Setup</p>
      </NewTableOverlay>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Close New Table/i })[0]!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard new table setup?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: /Close New Table/i })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
