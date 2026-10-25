import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { patternWorkspace } from './fixtures/patterns';
import { openApp, section } from './helpers';

// A row that leads to one record is one link (LA-PAT-APP-UX-R05): anywhere on the row opens the
// record, and the row's other controls keep doing what they do.
//
// jsdom has no layout, so it cannot find the element under the pointer. `clickAt` sends the click
// where the browser does, by the stylesheet's own selectors: to the nearest lifted control
// (z-index above the stretched link) between the target and its row, or else to the row's link,
// whose ::after covers the row.

const CSS = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
const selectorOf = (pattern: RegExp) => {
  const line = CSS.split('\n').find((l) => pattern.test(l));
  expect(line).toBeDefined();
  return line!.slice(0, line!.indexOf('{')).trim();
};
const ROWS = selectorOf(/^:is\([^{]*\)\s*\{\s*position:\s*relative;\s*\}/);
const LIFTED = selectorOf(/:not\(\.row-link\)\s*\{[^}]*z-index:\s*1/);

function clickAt(target: Element, init: MouseEventInit = {}) {
  const row = target.closest(ROWS);
  expect(row).not.toBeNull();
  let hit: Element | null = null;
  for (let el: Element | null = target; el && el !== row; el = el.parentElement) if (el.matches(LIFTED)) { hit = el; break; }
  hit ??= row!.querySelector('.row-link');
  expect(hit).not.toBeNull();
  return fireEvent.click(hit!, init);
}

const rowOf = (scope: HTMLElement, id: string) =>
  within(scope).getByRole('link', { name: new RegExp(`^${id}(?![-\\d])`) }).closest(ROWS) as HTMLElement;

describe('the whole row is clickable', () => {
  it('LA-BRW-T401 A click on a row opens its record, and a click on its chevron or second link does what that control does', async () => {
    await openApp('/specs/DM/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const uc = rowOf(section(/^Capabilities/), 'DM-SHOP-UC01');
    expect(uc).toHaveClass('tree-row');

    // The chevron folds the row and stays on the page.
    const toggle = within(uc).getByRole('button', { name: 'Expand DM-SHOP-UC01' });
    clickAt(toggle.querySelector('svg') ?? toggle);
    expect(within(uc).getByRole('button', { name: 'Collapse DM-SHOP-UC01' })).toHaveAttribute('aria-expanded', 'true');
    expect(window.location.pathname).toBe('/specs/DM/DM-SHOP');

    // The arrow keys still fold it from its link.
    const link = uc.querySelector<HTMLAnchorElement>('.row-link')!;
    expect(link).toHaveAttribute('href', '/records/DM-SHOP-UC01');
    fireEvent.keyDown(link, { key: 'ArrowLeft' });
    expect(within(uc).getByRole('button', { name: 'Expand DM-SHOP-UC01' })).toHaveAttribute('aria-expanded', 'false');

    // Cmd/Ctrl-click is left to the browser (a new tab): the app does not navigate.
    expect(clickAt(uc, { metaKey: true })).toBe(true);
    expect(clickAt(uc, { ctrlKey: true })).toBe(true);
    expect(window.location.pathname).toBe('/specs/DM/DM-SHOP');

    // A plain click on the row's padding, or on its plain text, opens the record.
    clickAt(uc);
    expect(window.location.pathname).toBe('/records/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();

    // A second link in a row opens what it names, not the row's record.
    await openApp('/specs/DM/DM-PAY', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    const pattern = rowOf(section(/^Patterns we follow/), 'DM-PAT-CHECKOUT');
    const followedBy = within(pattern).getByRole('link', { name: 'DM-PAY-UC01' });
    clickAt(followedBy.querySelector('code') ?? followedBy);
    expect(window.location.pathname).toBe('/records/DM-PAY-UC01');

    // And the row's plain text opens the pattern.
    await openApp('/specs/DM/DM-PAY', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    clickAt(within(rowOf(section(/^Patterns we follow/), 'DM-PAT-CHECKOUT')).getByText(/followed by/));
    expect(window.location.pathname).toBe('/records/DM-PAT-CHECKOUT');
  });
});
