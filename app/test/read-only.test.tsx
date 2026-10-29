import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { recordIds } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { ALL_QUERIES } from '../../lathe/src/commands';
import { main, openApp } from './helpers';

const PAGES = ['/', '/DM', '/NF', '/DM-SHOP', '/DM?panel=checks', '/DM?page=format', '/DM?page=format/kinds/use_case', '/DM?page=format/checks/not-proved', ...recordIds(workspace()).map((id) => `/${id}`)];

/** The record actions: the only controls on a page that lead to a write. */
const RECORD_ACTIONS = ['Edit', 'Add…', 'Move', 'Remove'];
const isRecordAction = (button: HTMLButtonElement) => RECORD_ACTIONS.includes(button.textContent ?? '') || /^Add /.test(button.textContent ?? '');

/** The aggregates' reads: GET /api/<aggregate>/<query>, each a query of an aggregate. */
const QUERY_ROUTES = ALL_QUERIES.map((q) => `${q.method} ${q.route}`);
/** What a page reads: the spec, its aggregate's reads, and the Changes baseline it compares the spec with (GET /api/baseline, LA-EXP-EP02). */
const isRead = (r: string) => r === 'GET /api/spec' || r.startsWith('GET /api/baseline?') || QUERY_ROUTES.includes(r.split('?')[0]);

// One test case per page, so each stays well within the time a test may take however many pages there are.
describe('LA-V92-R08-T01 Pages only read until the person acts: the record actions are the only controls that lead to a write, and opening a page or searching it sends none', () => {
  it.each(PAGES)('on %s', async (page) => {
    const user = userEvent.setup();
    const { requests, writes, commands } = await openApp(page);
    await screen.findAllByRole('heading', { level: 1 });
    const area = main();
    // No form or editor until Edit, Add or Remove is chosen; outside the stage's own view controls (the graph's filters, the trace's Gaps only, the Changes baseline), the search boxes are the only inputs.
    expect(area.querySelectorAll('form, textarea, [contenteditable]'), page).toHaveLength(0);
    expect([...area.querySelectorAll('select')].filter((select) => !select.closest('[data-stage]')), page).toHaveLength(0);
    const inputs = [...area.querySelectorAll('input')].filter((input) => !input.closest('[data-stage]'));
    for (const input of inputs) expect(input.type, page).toBe('search');
    // Every button is a plain button (none submits), and only the record actions change a record.
    const buttons = [...area.querySelectorAll('button')];
    for (const button of buttons) expect(button.type, page).toBe('button');
    const actions = area.querySelector('[role="toolbar"][aria-label^="Change "]');
    if (page === '/DM-SHOP-UC01') expect(actions, page).not.toBeNull();
    for (const button of buttons.filter(isRecordAction)) expect(actions?.contains(button), `${page}: ${button.textContent}`).toBe(true);
    // Use the page: type in the search box.
    for (const input of inputs) await user.type(input, 'basket');
    expect(writes, page).toEqual([]);
    expect(commands, page).toEqual([]);
    expect(requests.every(isRead), `${page}: ${requests.join(', ')}`).toBe(true);
  });
});
