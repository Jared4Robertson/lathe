import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CARD_MIN } from '../src/exploring/session-settings/model';
import { crowded, crowdedLabel, openWidth, STAGE_MIN, toolWidthOf, type CrowdPanel, type Room } from '../src/views/openSpace';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';

// Panels never crowd the page (LA-PAT-APP-UX-R18): when the window can't hold every open panel at its
// readable width, the wiki card collapses for space first, then the nav; the chat and a tool over the
// stage stay. The Reader's choices stay as set, a collapsed panel's toggle says so, and titles wrap on
// whole words.

const SRC = join(__dirname, '..', 'src');
const NONE = new Set<CrowdPanel>();
/** Every panel open at its default width: the nav 336 and the chat 400 px, and the wiki card. */
const room = (width: number, patch: Partial<Room> = {}): Room => ({
  width, inset: 8, nav: { open: true, width: 336, rail: 56 }, card: true, chat: 400, tool: null, held: NONE, ...patch });
const sorted = (set: ReadonlySet<CrowdPanel>) => [...set].sort();

function setWidth(width: number) {
  act(() => {
    window.innerWidth = width;
    window.dispatchEvent(new Event('resize'));
  });
}

function sheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sheets(path) : name.endsWith('.css') ? [path] : [];
  });
}

describe('LA-PAT-APP-UX-R18 Panels never crowd the page', () => {
  it('LA-PAT-APP-UX-R18-T01 Panels collapse for space wiki card first, then the nav, never the chat or a tool, the Dashboard takes no width, and titles never break mid-word', () => {
    // With every panel open, from the widest window down.
    expect(sorted(crowded(room(1920)))).toEqual([]);
    // The card's 28 px right gap: at 1440 px with the chat open the card gives way; from 1456 px it fits.
    expect(sorted(crowded(room(1456)))).toEqual([]);
    expect(sorted(crowded(room(1440)))).toEqual(['card']);
    expect(sorted(crowded(room(1280)))).toEqual(['card']);
    expect(sorted(crowded(room(1024)))).toEqual(['card', 'nav']);
    // Without the chat, 1440 and 1280 px hold them all.
    expect(sorted(crowded(room(1440, { chat: null })))).toEqual([]);
    expect(sorted(crowded(room(1280, { chat: null })))).toEqual([]);
    expect(sorted(crowded(room(1024, { chat: null })))).toEqual(['card']);
    // Whatever collapses leaves the stage its minimum, and the card its own (the chat never gives way).
    for (const width of [1024, 1280, 1440, 1456, 1920]) expect(openWidth(room(width), crowded(room(width)))).toBeGreaterThanOrEqual(STAGE_MIN);
    expect(CARD_MIN).toBeGreaterThanOrEqual(360);
    // A panel the Reader closed takes no room and is never "collapsed for space".
    expect(sorted(crowded(room(1024, { card: false })))).toEqual(['nav']);
    // One the Reader opened while collapsed is held: the next in the order gives way instead.
    expect(sorted(crowded(room(1440, { held: new Set(['card']) })))).toEqual(['nav']);
    // A tool over the stage never gives way: the card and the nav do instead.
    expect(sorted(crowded(room(1600, { tool: 360 })))).toEqual(['card']);
    expect(sorted(crowded(room(1280, { tool: 360 })))).toEqual(['card', 'nav']);
    // The Dashboard fills the window: it takes no width from the open space and collapses nothing.
    for (const width of [1024, 1280, 1440, 1920]) expect(sorted(crowded(room(width, { tool: toolWidthOf('dashboard') })))).toEqual(sorted(crowded(room(width))));

    // The card and the stage keep their minimums in the layout too, read from the shell's tokens.
    const css = sheets(SRC).map((f) => [f, readFileSync(f, 'utf8')] as const);
    const all = css.map(([, text]) => text).join('\n');
    expect(all).toMatch(/\.wiki-panel \{[^}]*min-width: var\(--card-min\)[^}]*max-width: calc\([^}]*var\(--stage-min\)/);
    // Titles wrap on whole words: no break-all on text anywhere, and no title breaks anywhere in a word.
    const offenders = css.flatMap(([file, text]) => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, body]) => /word-break:\s*break-all/.test(body) || (/overflow-wrap:\s*anywhere/.test(body) && /\bh[1-6]\b|title|-name\b|subject|strong/.test(selector)))
      .map(([, selector]) => `${file.slice(SRC.length + 1)}: ${selector.trim()}`));
    expect(offenders).toEqual([]);
  });

  it('LA-PAT-APP-UX-R18-T02 On a record page a narrow window collapses the wiki card, then the nav, each toggle saying so, and they come back as it widens', async () => {
    // Without the chat, the card fits from 1048 px; the nav to its rail below 652 px.
    window.innerWidth = 1000;
    await openApp('/P-D-UC01?stage=graph', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const app = document.querySelector('.app')!;
    // The wiki card gives way first; the nav stays.
    expect(app.getAttribute('data-crowded')).toBe('card');
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    expect(app).not.toHaveClass('nav-collapsed');
    const cardToggle = screen.getByRole('button', { name: crowdedLabel('card') });
    expect(cardToggle).toHaveClass('is-crowded');
    expect(cardToggle).toHaveAttribute('aria-expanded', 'false');

    // Opening it anyway holds it open, and the nav gives way instead.
    fireEvent.click(cardToggle);
    expect(screen.getByRole('region', { name: 'Wiki card' })).toBeInTheDocument();
    expect(app).toHaveClass('nav-collapsed');
    expect(screen.getByRole('button', { name: crowdedLabel('nav') })).toHaveClass('is-crowded');

    // A wide window holds them all, and the hold goes with the need.
    setWidth(1920);
    expect(app.hasAttribute('data-crowded')).toBe(false);
    expect(app).not.toHaveClass('nav-collapsed');
    expect(screen.getByRole('region', { name: 'Wiki card' })).toBeInTheDocument();
    expect(document.querySelector('.is-crowded')).toBeNull();

    // Narrowing again collapses them in order, the nav last; the Reader's choices stay as set.
    setWidth(1000);
    expect(app.getAttribute('data-crowded')).toBe('card');
    expect(app).not.toHaveClass('nav-collapsed');
    setWidth(600);
    expect(sorted(new Set((app.getAttribute('data-crowded') ?? '').split(' ') as CrowdPanel[]))).toEqual(['card', 'nav']);
    expect(app).toHaveClass('nav-collapsed');
    expect(screen.getByRole('button', { name: crowdedLabel('nav') })).toHaveClass('is-crowded');
    expect(window.localStorage.getItem('lathe:nav-collapsed')).not.toBe('true');
    setWidth(1920);
    expect(app).not.toHaveClass('nav-collapsed');
    expect(screen.getByRole('region', { name: 'Wiki card' })).toBeInTheDocument();
  });
});
