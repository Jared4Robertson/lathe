import './setup';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumb, collapseCrumbs, CRUMBS_SHOWN_ON_A_PHONE, type Crumb } from '../src/shell/Breadcrumb';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';

// One breadcrumb, collapsed past three places (LA-PAT-APP-UX-R16).

const crumbs = (n: number): Crumb[] => Array.from({ length: n }, (_, i) => ({ to: `/X${i}`, label: `Place ${i}`, full: `Place ${i} (X${i})` }));
const SRC = resolve(process.cwd(), 'src');
const filesUnder = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? filesUnder(p) : [p];
});

describe('the one breadcrumb', () => {
  it('LA-PAT-APP-UX-R16-T01 A trail of up to three shows in full; a longer one the first, a labeled "…" menu of the hidden levels, and the last', async () => {
    expect(collapseCrumbs([1, 2, 3])).toEqual({ first: [1, 2, 3], hidden: [], last: [] });
    expect(collapseCrumbs([1, 2, 3, 4, 5])).toEqual({ first: [1], hidden: [2, 3, 4], last: [5] });
    // On a phone (LA-V61-R57) every place but the last folds into the button.
    expect(collapseCrumbs([1, 2, 3], CRUMBS_SHOWN_ON_A_PHONE)).toEqual({ first: [], hidden: [1, 2], last: [3] });
    expect(collapseCrumbs([1], CRUMBS_SHOWN_ON_A_PHONE)).toEqual({ first: [1], hidden: [], last: [] });

    const { unmount } = render(<Breadcrumb items={crumbs(3)} />);
    const short = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(short.getAllByRole('link').map((a) => a.textContent)).toEqual(['Place 0', 'Place 1', 'Place 2']);
    expect(short.queryByRole('button')).toBeNull();
    unmount();

    render(<Breadcrumb items={crumbs(5)} />);
    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(trail.getAllByRole('link').map((a) => a.textContent)).toEqual(['Place 0', 'Place 4']);
    // Each place's whole name is its tooltip and accessible name.
    expect(trail.getByRole('link', { name: 'Place 0 (X0)' })).toHaveAttribute('title', 'Place 0 (X0)');
    const more = trail.getByRole('button', { name: '3 hidden levels' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('list', { name: 'Hidden levels' });
    const links = within(menu).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/X1', '/X2', '/X3']);
    // Opened, focus is on its first link; the arrows move through them, End and Home to the ends.
    await waitFor(() => expect(links[0]).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(links[1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(links[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(links[0]).toHaveFocus();
    // Escape closes it, focus back on the button.
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('list', { name: 'Hidden levels' })).toBeNull();
    await waitFor(() => expect(more).toHaveFocus());
    // A press elsewhere closes it too.
    fireEvent.click(more);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('list', { name: 'Hidden levels' })).toBeNull();
  });

  it('LA-PAT-APP-UX-R16-T02 The header strip, the wiki card and the phone\'s top bar each use the one component; nothing else draws a trail', async () => {
    await openApp('/P-D-UC01-FL-S01?stage=graph', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1 });
    const strip = document.querySelector<HTMLElement>('.header-strip')!;
    expect(within(strip).getByRole('navigation', { name: 'Breadcrumb' })).toHaveClass('breadcrumb');
    expect(within(screen.getByRole('region', { name: 'Wiki card' })).getByRole('navigation', { name: 'Wiki card breadcrumb' })).toHaveClass('breadcrumb');
    // In the source, only Breadcrumb.tsx renders crumbs; every trail is that component.
    const others = filesUnder(SRC).filter((f) => /\.tsx$/.test(f) && !f.endsWith('Breadcrumb.tsx'))
      .filter((f) => /className="[^"]*\b(crumb|graph-trail|topbar-up)\b/.test(readFileSync(f, 'utf8')));
    expect(others).toEqual([]);
    const users = filesUnder(SRC).filter((f) => /<Breadcrumb\b/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1)).sort();
    expect(users).toEqual(['shell/MobileBar.tsx', 'views/HeaderStrip.tsx', 'views/WikiCard.tsx']);
  });
  it('LA-V61-R47-T02 What the hidden levels\' menu covers is inert while it is open, a stage drawn under it after it opens too', async () => {
    // jsdom lays nothing out: the menu, and anything marked as the stage below it, are given boxes that overlap.
    const box = (l: number, t: number, r: number, b: number) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t, x: l, y: t, toJSON: () => ({}) }) as DOMRect;
    const boxes = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('crumb-menu')) return box(400, 44, 600, 180);
      if (this.dataset.stageTools) return box(352, 56, 1200, 98);
      if (this.dataset.floating) return box(1300, 56, 1400, 98);
      return box(0, 0, 0, 0);
    });
    try {
      render(<Breadcrumb items={crumbs(5)} />);
      const aside = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'aside' }));
      aside.dataset.floating = 'right';
      fireEvent.click(screen.getByRole('button', { name: '3 hidden levels' }));
      await screen.findByRole('list', { name: 'Hidden levels' });
      // The stage's toolbar is drawn only after the menu opened, under it: it turns inert; the panel clear of it does not.
      const tools = document.body.appendChild(document.createElement('div'));
      tools.dataset.stageTools = 'top';
      await waitFor(() => expect(tools.inert).toBe(true));
      expect(aside.inert).toBeFalsy();
      // Closed, nothing it covered stays inert.
      fireEvent.keyDown(screen.getByRole('list', { name: 'Hidden levels' }), { key: 'Escape' });
      expect(tools.inert).toBe(false);
      tools.remove();
      aside.remove();
    } finally {
      boxes.mockRestore();
    }
  });
});
