import './setup';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumb, collapseCrumbs, type Crumb } from '../src/shell/Breadcrumb';
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
    await openApp('/P-D-UC01-FL01-S01?stage=graph', { data: testWorkspace() });
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
});
