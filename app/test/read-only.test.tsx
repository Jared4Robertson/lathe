import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { recordIds } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

const PAGES = ['/', '/DM', '/NF', '/DM-SHOP', '/DM/checks', '/format', '/format/kinds/use_case', '/format/checks/not-proved', ...recordIds(workspace()).map((id) => `/${id}`)];

/** The record actions: the only controls on a page that lead to a write. */
const RECORD_ACTIONS = ['Edit', 'Add…', 'Remove'];
const isRecordAction = (button: HTMLButtonElement) => RECORD_ACTIONS.includes(button.textContent ?? '') || /^Add /.test(button.textContent ?? '');

describe('pages read until the person acts', () => {
  it('LA-V92-R08-T01 Pages only read GET /api/spec until the person acts: the record actions are the only controls that lead to a write, and opening a page or searching it sends none', async () => {
    const user = userEvent.setup();
    for (const page of PAGES) {
      const { requests, writes } = await openApp(page);
      await screen.findAllByRole('heading', { level: 1 });
      const area = main();
      // No form or editor until Edit, Add or Remove is chosen; the search boxes are the only inputs.
      expect(area.querySelectorAll('form, textarea, select, [contenteditable]'), page).toHaveLength(0);
      for (const input of area.querySelectorAll('input')) expect(input.type, page).toBe('search');
      // Every button is a plain button (none submits), and only the record actions change a record.
      const buttons = [...area.querySelectorAll('button')];
      for (const button of buttons) expect(button.type, page).toBe('button');
      const actions = area.querySelector('[role="toolbar"][aria-label^="Change "]');
      if (page === '/DM-SHOP-UC01') expect(actions, page).not.toBeNull();
      for (const button of buttons.filter(isRecordAction)) expect(actions?.contains(button), `${page}: ${button.textContent}`).toBe(true);
      // Use the page: type in the search box.
      for (const input of area.querySelectorAll('input')) await user.type(input, 'basket');
      expect(writes, page).toEqual([]);
      expect(requests.every((r) => r === 'GET /api/spec'), `${page}: ${requests.join(', ')}`).toBe(true);
    }
  });
});
