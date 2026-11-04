import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { navigate } from '../src/router';
import { openApp, startAtDepth } from './helpers';
import './graph/setup';
import { testWorkspace } from './graph/workspace';
import { boxElement } from './graph/scene';

// "Nothing jumps" (LA-PAT-APP-UX-R08), at the level jsdom can check: the causes of jitter that
// show in the source. The stability suite (app/stability, `npm --prefix app run test:stability`)
// measures the rest in a real browser.

const CSS = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');

interface Rule { selector: string; decls: Map<string, string>; line: number; within: string[] }

/** Every style rule, with its declarations, its line and the at-rules it sits in. */
function rules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const out: Rule[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const head = text.slice(start, i).trim();
      if (head.startsWith('@')) { stack.push(head); start = i + 1; continue; }
      const end = text.indexOf('}', i);
      const decls = new Map<string, string>();
      for (const d of text.slice(i + 1, end).split(';')) {
        const at = d.indexOf(':');
        if (at > 0) decls.set(d.slice(0, at).trim(), d.slice(at + 1).trim());
      }
      if (!stack.some((h) => h.startsWith('@keyframes'))) out.push({ selector: head, decls, line: text.slice(0, i).split('\n').length, within: [...stack] });
      i = end;
      start = end + 1;
    } else if (text[i] === '}') {
      stack.pop();
      start = i + 1;
    }
  }
  return out;
}

const ALL = rules(CSS);
/** A rule's selectors, split at its top-level commas (not those inside `:is(…)`). */
function selectors(r: Rule): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  const s = r.selector;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim().replace(/\s+/g, ' '));
}
/** The value a property has for a selector, from any rule that names that exact selector (the last one wins). */
function valueFor(selector: string, property: string): string | undefined {
  let value: string | undefined;
  for (const r of ALL) if (selectors(r).includes(selector) && r.decls.has(property)) value = r.decls.get(property);
  return value;
}

/** Does a rule make its box scroll up and down? `overflow: auto`, `overflow-y: scroll`, or `overflow: hidden auto`. */
function scrollsVertically(r: Rule): boolean {
  const y = r.decls.get('overflow-y') ?? (() => {
    const parts = (r.decls.get('overflow') ?? '').split(/\s+/).filter(Boolean);
    return parts.length === 2 ? parts[1] : parts[0];
  })();
  return y === 'auto' || y === 'scroll';
}

/**
 * A box keeps its gutter when a rule for it, or for the end of its selector (`.erd-key` for `.app.is-narrow .erd-key`),
 * sets `scrollbar-gutter: stable`, or hides its scrollbar (`scrollbar-width: none`), so there is none to come and go.
 */
function keepsGutter(selector: string): boolean {
  const steady = (r: Rule) => r.decls.get('scrollbar-gutter') === 'stable' || r.decls.get('scrollbar-width') === 'none';
  return ALL.some((r) => steady(r) && selectors(r).some((s) => s === selector || selector.endsWith(` ${s}`)));
}

describe('nothing jumps (LA-PAT-APP-UX-R08)', () => {
  it('LA-V61-R39-T01 every scroll box keeps room for its scrollbar, so it never comes and goes with the content', () => {
    const boxes = ALL.filter(scrollsVertically).flatMap((r) => selectors(r).map((s) => ({ s, line: r.line })));
    expect(boxes.length).toBeGreaterThan(5);
    const missing = boxes.filter(({ s }) => !keepsGutter(s)).map(({ s, line }) => `app/src/styles.css:${line}: ${s} needs scrollbar-gutter: stable`);
    expect(missing).toEqual([]);
  });
  it('LA-PAT-APP-UX-R08-T01 the bars above a stage have one height whatever their text', () => {
    // The tab panel: the page bar and the header strip under it, each a fixed height, each line cut with an ellipsis.
    expect(valueFor('.page-bar', 'height')).toBe('var(--page-bar-height)');
    expect(valueFor('.header-strip', 'height')).toBe('var(--strip-height)');
    // On the web the header strip is the panel's one row, as high as a page bar.
    expect(valueFor('.stage-layout.one-place:not(.is-phone) .header-strip', 'height')).toBe('var(--page-bar-height)');
    expect(valueFor('.header-strip', 'white-space')).toBe('nowrap');
    expect(valueFor('.header-strip-title', 'text-overflow')).toBe('ellipsis');
    expect(valueFor('.header-strip-counts', 'text-overflow')).toBe('ellipsis');
    // Every stage's toolbar: one line.
    expect(valueFor('.stage-toolbar', 'flex-wrap')).toBe('nowrap');
  });

  it('LA-V61-R38-T02 a count or caption that changes is one text, so a new number never moves the text after it', async () => {
    startAtDepth(1);
    await openApp('/P-D-UC01-R01?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.header-strip-counts')?.textContent).toMatch(/record/));
    const count = document.querySelector('.header-strip-counts')!;
    expect([...count.childNodes].map((n) => n.nodeType)).toEqual([Node.TEXT_NODE]);
    // It ends the header strip's text, right-aligned, so a new count moves nothing before it; only the page's controls,
    // of one fixed width, follow it (on the web, where they share its row); the stage's toolbar holds none.
    expect(count.parentElement?.classList.contains('header-strip')).toBe(true);
    expect(count.nextElementSibling === null || (count.nextElementSibling.classList.contains('page-bar-actions') && count.nextElementSibling.nextElementSibling === null)).toBe(true);
    expect(document.querySelector('.stage-toolbar .header-strip-counts')).toBeNull();
  });

  it('LA-V61-R38-T02 the graph canvas stays mounted when the graph re-centers', async () => {
    startAtDepth(1);
    await openApp('/P-D-UC01?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(boxElement('P-D-CAP01')).not.toBeNull());
    const canvas = document.querySelector('.graph-flow');
    const drawing = document.querySelector('.graph-flow canvas');
    fireEvent.click(boxElement('P-D-CAP01')!);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-CAP01'));
    await waitFor(() => expect(boxElement('P-D-UC01')).not.toBeNull());
    expect(document.querySelector('.graph-flow')).toBe(canvas);
    expect(document.querySelector('.graph-flow canvas')).toBe(drawing);
  });

  it('LA-V61-R38-T02 what the graph counts reaches the header strip before paint, not an effect later', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'graph', 'GraphPage.tsx'), 'utf8');
    expect(source).toMatch(/useLayoutEffect\(\(\) => \{ onCounts\?\.\(/);
    const model = readFileSync(join(__dirname, '..', 'src', 'erd', 'ErdView.tsx'), 'utf8');
    // The ERD map is framed before its first paint, and observes its size once (each new observer reported the size again and cut the glide short).
    expect(model).toMatch(/useLayoutEffect\(\(\) => \{\n[^;]*;\n[^;]*;\n\s*if \(frameFocus\(fitted\.current\)\) \{ fitted\.current = true;/);
    expect(model).toMatch(/observer\.observe\(el\);\n\s*return \(\) => observer\.disconnect\(\);\n\s*\}, \[\]\);/);
  });

  it('LA-V61-R38-T02 a move made outside the nav leaves its rows where they are: the closed row holding the page is marked, and opens the branch down to it', async () => {
    window.sessionStorage.clear();
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const panel = () => screen.getByRole('navigation', { name: 'Main' }).querySelector<HTMLElement>('.space-items')!;
    const unfold = () => within(panel()).getByRole('button', { name: 'Unfold Shopping' });
    expect(unfold()).toHaveAttribute('aria-expanded', 'false');
    // A link in the page (here, the address set from outside the nav) moves to a UC requirement inside Shopping.
    act(() => navigate('/DM-SHOP-UC01-R01'));
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    expect(unfold()).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).queryByRole('list', { name: 'Folders of Shopping' })).toBeNull();
    expect(unfold().closest('.nav-row')).toHaveClass('holds-current');
    // Opening the marked row opens the branch down to the page.
    fireEvent.click(unfold());
    expect(within(await within(panel()).findByRole('list', { name: 'Use cases of Shopping' })).getByRole('link', { name: 'Buying' })).toBeInTheDocument();
  });

  it('LA-V61-R38-T02 the fonts are the app\'s own, preloaded, and never swap in', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(html.match(/<link rel="preload" href="\/fonts\/[^"]+\.woff2" as="font" type="font\/woff2" crossorigin \/>/g)?.length).toBe(6);
    const fonts = readFileSync(join(__dirname, '..', 'src', 'fonts.css'), 'utf8');
    const faces = fonts.match(/@font-face \{[^}]*\}/g) ?? [];
    expect(faces.length).toBe(12);
    for (const face of faces) expect(face).toMatch(/font-display: optional;/);
    for (const family of ['archivo', 'public-sans', 'jetbrains-mono']) expect(readFileSync(join(__dirname, '..', 'public', 'fonts', family, 'OFL.txt'), 'utf8')).toMatch(/SIL Open Font License/);
  });
});
