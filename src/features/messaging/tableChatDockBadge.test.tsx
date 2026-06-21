import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableChatDock } from './TableChatDock';

describe('TableChatDock unread badge', () => {
  it('renders Chat label with badge markup instead of inline unread text', () => {
    const html = renderToStaticMarkup(
      <TableChatDock
        tableId="table-1"
        currentUserEmail="alice@example.com"
        currentUserName="Alice"
      />,
    );
    expect(html).toContain('table-chat-toggle__label');
    expect(html).toContain('>Chat<');
    expect(html).not.toMatch(/Chat • 1/);
  });

  it('defines red circular badge styles for unread count', () => {
    const css = readFileSync(join(process.cwd(), 'src/features/messaging/TableChatDock.css'), 'utf8');
    expect(css).toMatch(/\.table-chat-toggle__badge[\s\S]*background:\s*#dc2626/);
    expect(css).toMatch(/\.table-chat-toggle__badge[\s\S]*color:\s*#fff/);
    expect(css).toMatch(/border-radius:\s*999px/);
  });
});
