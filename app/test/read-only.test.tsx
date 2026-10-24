import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { records } from './fixtures/workspace';
import { main, openApp } from './helpers';

const PAGES = ['/specs', '/specs/DM', '/specs/NF', '/specs/DM/DM-SHOP', '/checks', '/format', ...records.map((r) => `/records/${r.id}`)];

describe('spec pages only read', () => {
  it('LA-BRW-T20 Spec pages offer no way to change a record and only ever read GET /api/spec', async () => {
    const user = userEvent.setup();
    for (const page of PAGES) {
      const { requests } = await openApp(page);
      await screen.findAllByRole('heading', { level: 1 }).catch(() => screen.findByText(/Lathe spec format/));
      const area = main();
      // No forms, buttons, editable fields or editors; the domain page's search box is the only input.
      expect(area.querySelectorAll('form, button, textarea, select, [contenteditable]'), page).toHaveLength(0);
      for (const input of area.querySelectorAll('input')) expect(input.type, page).toBe('search');
      // Use the page: type in the search box.
      for (const input of area.querySelectorAll('input')) await user.type(input, 'basket');
      expect(requests.every((r) => r === 'GET /api/spec' || r === 'GET /api/diagrams'), `${page}: ${requests.join(', ')}`).toBe(true);
    }
  });
});
