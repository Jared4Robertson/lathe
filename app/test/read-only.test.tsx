import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { records } from './fixtures/workspace';
import { main, openApp } from './helpers';

const PAGES = ['/', '/DM', '/NF', '/DM-SHOP', '/DM/checks', '/format', '/format/kinds/use_case', '/format/checks/unproved', ...records.map((r) => `/${r.id}`)];

describe('spec pages only read', () => {
  it('LA-EXP-T12 Spec pages offer no way to change a record and only ever read GET /api/spec (and the format reference)', async () => {
    const user = userEvent.setup();
    for (const page of PAGES) {
      const { requests } = await openApp(page);
      await screen.findAllByRole('heading', { level: 1 }).catch(() => screen.findByText(/Lathe spec format/));
      const area = main();
      // No forms, editable fields or editors; the search boxes are the only inputs, and the buttons
      // only change the view (wiki, graph, split, full screen, sideBar, folded rows), never a record.
      expect(area.querySelectorAll('form, textarea, select, [contenteditable]'), page).toHaveLength(0);
      for (const button of area.querySelectorAll('button')) expect(button.type, page).toBe('button');
      for (const input of area.querySelectorAll('input')) expect(input.type, page).toBe('search');
      // Use the page: type in the search box.
      for (const input of area.querySelectorAll('input')) await user.type(input, 'basket');
      expect(requests.every((r) => r === 'GET /api/spec' || r === 'GET /api/format'), `${page}: ${requests.join(', ')}`).toBe(true);
    }
  });
});
