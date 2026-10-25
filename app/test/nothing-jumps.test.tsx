import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { navigate } from '../src/router';
import { openApp, startAtDepth } from './helpers';
import './graph/setup';
import { testWorkspace } from './graph/workspace';

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
  it('LA-BRW-T488 every scroll box keeps room for its scrollbar, so it never comes and goes with the content', () => {
    const boxes = ALL.filter(scrollsVertically).flatMap((r) => selectors(r).map((s) => ({ s, line: r.line })));
    expect(boxes.length).toBeGreaterThan(5);
    const missing = boxes.filter(({ s }) => !keepsGutter(s)).map(({ s, line }) => `app/src/styles.css:${line}: ${s} needs scrollbar-gutter: stable`);
    expect(missing).toEqual([]);
  });

  it('LA-BRW-T488 the bars above a canvas have one height whatever their text', () => {
    // The pane title above a graph or a model: a fixed block size, each line cut with an ellipsis.
    expect(valueFor('.pane-title.is-fixed', 'height') ?? valueFor('.pane-title.is-fixed', 'block-size')).toBe('var(--pane-title-height)');
    expect(valueFor('.pane-title.is-fixed :is(.eyebrow, h1, .record-id)', 'white-space')).toBe('nowrap');
    // The graph's trail and toolbar: one line each; the trail scrolls sideways instead of wrapping.
    expect(valueFor('.graph-trail ol', 'flex-wrap')).toBe('nowrap');
    expect(valueFor('.graph-trail ol', 'block-size')).toBeTruthy();
    expect(valueFor('.graph-trail ol', 'overflow')).toBe('auto hidden');
    expect(valueFor('.graph-toolbar', 'flex-wrap')).toBe('nowrap');
    expect(valueFor('.graph-count', 'text-overflow')).toBe('ellipsis');
    // The Model view: its caption is one line, and its key has one height for every ERD.
    expect(valueFor('.model-caption', 'white-space')).toBe('nowrap');
    expect(valueFor('.erd-key', 'block-size')).toBe('var(--erd-key-height)');
    expect(CSS).toMatch(/--erd-key-height:\s*[0-9.]+rem/);
    // A pane's title bar is one row.
    expect(valueFor('.pane-bar', 'display')).toBe('flex');
    expect(valueFor('.pane-bar', 'flex-wrap') ?? 'nowrap').toBe('nowrap');
  });

  it('LA-BRW-T488 a count or caption that changes is one text, so a new number never moves the text after it', async () => {
    startAtDepth(1);
    await openApp('/P-D-UC01-R01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.graph-count')).not.toBeNull());
    const count = document.querySelector('.graph-count')!;
    expect([...count.childNodes].map((n) => n.nodeType)).toEqual([Node.TEXT_NODE]);
    // It sits right after the depth, whose width never changes.
    expect(count.previousElementSibling?.classList.contains('graph-depth')).toBe(true);
  });

  it('LA-BRW-T488 the graph canvas stays mounted when the graph re-centers', async () => {
    startAtDepth(2);
    await openApp('/P-D-UC01-R01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="P-D-V01"]')).not.toBeNull());
    const canvas = document.querySelector('.graph-flow');
    const flow = document.querySelector('.graph-flow .react-flow');
    fireEvent.click(document.querySelector('.react-flow__node[data-id="P-D-V01"]')!);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-V01'));
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="P-D-E01"]')).not.toBeNull());
    expect(document.querySelector('.graph-flow')).toBe(canvas);
    expect(document.querySelector('.graph-flow .react-flow')).toBe(flow);
  });

  it('LA-BRW-T488 what the graph connects reaches the inspector before paint, not an effect later', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'graph', 'GraphPage.tsx'), 'utf8');
    expect(source).toMatch(/useLayoutEffect\(\(\) => \{ onGraph\?\.\(/);
    const model = readFileSync(join(__dirname, '..', 'src', 'model', 'ModelView.tsx'), 'utf8');
    // The ERD is fitted before its first paint, and observes its size once (each new observer reported the size again and cut the glide short).
    expect(model).toMatch(/useLayoutEffect\(\(\) => \{\n\s*if \(!placed\) return;\n\s*fit\(fitted\.current\);/);
    expect(model).toMatch(/observer\.observe\(el\);\n\s*return \(\) => observer\.disconnect\(\);\n\s*\}, \[\]\);/);
  });

  it('LA-BRW-T488 a move made outside the nav leaves its rows where they are: the closed row holding the page is marked, and opens the branch down to it', async () => {
    window.sessionStorage.clear();
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const panel = () => screen.getByRole('navigation', { name: 'Main' }).querySelector<HTMLElement>('.space-items')!;
    const unfold = () => within(panel()).getByRole('button', { name: 'Unfold Shopping' });
    expect(unfold()).toHaveAttribute('aria-expanded', 'false');
    // A link in the page (here, the address set from outside the nav) moves to a requirement inside Shopping.
    act(() => navigate('/DM-SHOP-UC01-R01'));
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    expect(unfold()).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).queryByRole('list', { name: 'Folders of Shopping' })).toBeNull();
    expect(unfold().closest('.nav-row')).toHaveClass('holds-current');
    // Opening the marked row opens the branch down to the page.
    fireEvent.click(unfold());
    expect(within(await within(panel()).findByRole('list', { name: 'Capabilities of Shopping' })).getByRole('link', { name: 'Add an item to the basket' })).toBeInTheDocument();
  });

  it('LA-BRW-T488 the fonts are the app\'s own, preloaded, and never swap in', () => {
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
