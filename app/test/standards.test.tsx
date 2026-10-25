import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';
// The split view loads the graph, which needs a ResizeObserver in jsdom.
import './graph/setup';

// The app's coding standards (LA-PAT-APP-CODE): each test proves one of the pattern's rules,
// by reading the source or by rendering pages. A failure names the file and line to fix.

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'app', 'src');
const CSS = readFileSync(join(SRC, 'styles.css'), 'utf8');

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? filesUnder(path, ext) : ext.test(name) ? [path] : [];
  });
}

/** Lines of `text` matching `pattern`, as "file:line: text", for a readable failure. */
function where(file: string, text: string, pattern: RegExp): string[] {
  return text.split('\n').flatMap((line, i) => (pattern.test(line) ? [`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`] : []));
}

/** Every style rule in the stylesheet, with its selectors and whether it sits in a `:root` block. */
function styleRules(css: string): { selector: string; body: string; line: number }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const rules: { selector: string; body: string; line: number }[] = [];
  let depth = 0;
  let start = 0;
  const stack: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const head = text.slice(start, i).trim();
      stack.push(head);
      depth++;
      start = i + 1;
      if (!head.startsWith('@') && !stack.slice(0, -1).some((h) => h.startsWith('@keyframes'))) {
        const end = text.indexOf('}', i);
        rules.push({ selector: head, body: text.slice(i + 1, end), line: text.slice(0, i).split('\n').length });
        stack.pop();
        depth--;
        i = end;
        start = end + 1;
      }
    } else if (text[i] === '}') {
      stack.pop();
      depth--;
      start = i + 1;
    } else if (text[i] === ';' && depth === 0) {
      start = i + 1; // an @import or @charset line
    }
  }
  return rules;
}

/** A selector list split at its own commas, not those inside :is() or :not(). */
function topLevel(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')') depth--;
    else if (selector[i] === ',' && depth === 0) { parts.push(selector.slice(from, i)); from = i + 1; }
  }
  return [...parts, selector.slice(from)];
}

/** Elements the base styles may set on their own: the page, its text and its plain controls. */
const BASE_ELEMENTS = new Set(['html', 'body', 'h1', 'h2', 'h3', 'h4', 'p', 'a', 'code', 'pre', 'kbd', 'small', 'strong', 'button', 'input', 'textarea', 'select', 'table', 'th', 'td', 'svg']);

describe('LA-PAT-APP-CODE App code', () => {
  it('LA-BRW-T256 Layout lives in the markup: no stylesheet rule moves or restyles an element from outside its component', async () => {
    expect(where('app/src/styles.css', CSS, /display:\s*contents|:has\(/)).toEqual([]);
    // A section's own header row holds its list's Expand all: the button sits inside the header.
    await openApp('/records/DM');
    const children = screen.getByRole('heading', { level: 2, name: /^Children/ }).closest('section')!;
    const header = children.querySelector(':scope > header.spec-section-head')!;
    expect(header).not.toBeNull();
    const bulk = within(children).queryByRole('button', { name: /Expand all|Collapse all/ });
    if (bulk) expect(header.contains(bulk)).toBe(true);
  });

  it('LA-BRW-T257 Styles are set by class: no selector names only elements, beyond the base styles', () => {
    const bare = styleRules(CSS)
      .flatMap((r) => topLevel(r.selector).map((s) => ({ s: s.trim(), line: r.line })))
      .filter(({ s }) => s !== ':root' && !/[.#[]/.test(s))
      .filter(({ s }) => !s.split(/[\s>+~]+/).every((part) => BASE_ELEMENTS.has(part.replace(/:{1,2}[\w-]+(\(.*?\))?/g, ''))))
      .map(({ s, line }) => `app/src/styles.css:${line}: ${s}`);
    expect(bare).toEqual([]);
  });

  it('LA-BRW-T258 Colors and shadows are tokens: color values appear only where :root defines them', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;
    const outside = styleRules(CSS)
      .filter((r) => r.selector !== ':root' && literal.test(r.body))
      .map((r) => `app/src/styles.css:${r.line}: ${r.selector}`);
    expect(outside).toEqual([]);
    // Inline styles in components set no colors either.
    const inline = filesUnder(SRC, /\.tsx$/).flatMap((f) => where(f, readFileSync(f, 'utf8'), /style=\{\{[^}]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\()/));
    expect(inline).toEqual([]);
  });

  it('LA-BRW-T259 Generic components know nothing of specs, the graph or the shell: they import only React, each other and the text helpers', () => {
    const imports = filesUnder(join(SRC, 'components'), /\.tsx?$/).flatMap((f) =>
      where(f, readFileSync(f, 'utf8'), /^import .* from '(?!react\b|react-dom\b|\.\/|\.\.\/plural')/),
    );
    expect(imports).toEqual([]);
  });

  it('LA-BRW-T260 Kind labels become plural only through plural() and lowercase only through lowerLabel()', () => {
    const naive = filesUnder(SRC, /\.tsx?$/)
      .filter((f) => !f.endsWith('plural.ts'))
      .flatMap((f) => where(f, readFileSync(f, 'utf8'), /\$\{[^}]*[lL]abel[^}]*\}s\b|[lL]abel\)?\s*\+\s*'s'|[lL]abel(?:\([^)]*\))?\.(?:charAt\(0\)\.)?toLowerCase\(\)/));
    expect(naive).toEqual([]);
  });

  it('LA-BRW-T261 Every button and link on the main pages has an accessible name', async () => {
    for (const path of ['/', '/specs/DM/DM-SHOP', '/records/DM-SHOP-UC01', '/records/DM-SHOP-UC01?view=graph']) {
      await openApp(path);
      // The role queries compute each control's accessible name; keep the ones whose name is empty.
      const controls = ['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio'].flatMap((role) => screen.queryAllByRole(role));
      const unnamed = ['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio']
        .flatMap((role) => screen.queryAllByRole(role, { name: (name) => name.trim() === '' }))
        .map((el) => `${path}: ${el.outerHTML.slice(0, 120)}`);
      expect(controls.length).toBeGreaterThan(0);
      expect(unnamed).toEqual([]);
    }
  });

  it('LA-BRW-T276 Everything clickable shows a hover state: each pointer-cursor rule has a :hover rule for the same class', () => {
    const rules = styleRules(CSS);
    const hovers = rules.flatMap((r) => topLevel(r.selector)).filter((s) => s.includes(':hover'));
    const missing = rules
      .filter((r) => /cursor:\s*pointer/.test(r.body))
      .flatMap((r) => topLevel(r.selector).map((s) => ({ s: s.trim(), line: r.line })))
      .filter(({ s }) => {
        const classes = s.match(/\.[\w-]+/g);
        const key = classes?.[classes.length - 1];
        return !key || !hovers.some((h) => new RegExp(`\\${key}(?![\\w-])`).test(h));
      })
      .map(({ s, line }) => `app/src/styles.css:${line}: ${s}`);
    expect(missing).toEqual([]);
    // The tint, ring and speed are shared tokens.
    for (const token of ['--hover-bg', '--hover-ring', '--hover-speed']) expect(CSS).toContain(`${token}:`);
  });

  it('LA-BRW-T294 The workbench: panels sit on the shell a gap apart, and every gap between two panels is the one ResizeHandle', async () => {
    for (const token of ['--shell:', '--panel-gap:', '--panel-radius:']) expect(CSS).toContain(token);
    // One implementation: no other component draws a separator of its own.
    const separators = filesUnder(SRC, /\.tsx$/).filter((f) => !f.endsWith('ResizeHandle.tsx')).flatMap((f) => where(f, readFileSync(f, 'utf8'), /role="separator"/));
    expect(separators).toEqual([]);
    // On a record in the Split view with the inspector open: nav, wiki, graph and inspector, each gap a handle.
    await openApp('/records/DM-SHOP-UC01?view=split');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // A focusable separator (one with a value) is a splitter; a plain divider line such as the rail's is not.
    const handles = screen.getAllByRole('separator').filter((h) => h.hasAttribute('aria-valuenow')).map((h) => [h.getAttribute('aria-label'), h.classList.contains('resize-handle')]);
    expect(handles).toEqual([['Resize the navigation', true], ['Resize the panes', true], ['Resize the inspector', true]]);
    for (const panel of [document.querySelector('#nav'), ...document.querySelectorAll('.pane'), document.querySelector('.inspector-column')]) expect(panel).toHaveClass('panel');
  });

  it('LA-BRW-T295 Every grid says its columns, a single column being minmax(0, 1fr), so content shrinks with its panel', () => {
    const unsized = styleRules(CSS)
      .filter((r) => /display:\s*(?:inline-)?grid/.test(r.body) && !/grid-template-columns/.test(r.body) && !/place-items/.test(r.body))
      .map((r) => `app/src/styles.css:${r.line}: ${r.selector}`);
    expect(unsized).toEqual([]);
  });

  it('LA-BRW-T298 Each pane has one title bar holding its tabs and layout actions, and nothing else switches views', async () => {
    for (const path of ['/records/DM-SHOP-UC01?view=wiki', '/records/DM-SHOP-UC01?view=split']) {
      await openApp(path);
      await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
      const panes = [...document.querySelectorAll<HTMLElement>('.pane')];
      expect(panes.length).toBeGreaterThan(0);
      for (const pane of panes) {
        expect(pane).toHaveClass('panel');
        expect(pane.firstElementChild).toHaveClass('pane-bar');
        expect(pane.querySelectorAll(':scope > .pane-bar')).toHaveLength(1);
      }
      // Every view and layout control lives in a title bar.
      const controls = [
        ...screen.getAllByRole('tab'),
        ...screen.queryAllByRole('button', { name: /beside$|^Close the (wiki|graph) pane$|^Full screen|^Leave full screen/ }),
        screen.getByRole('button', { name: /the inspector$/, expanded: true }),
      ];
      for (const c of controls) expect(c.closest('.pane-bar')).not.toBeNull();
      // The title belongs to the content of a pane.
      expect(screen.getByRole('heading', { level: 1 }).closest('.pane')).not.toBeNull();
    }
  });

  it('LA-BRW-T262 Code, specs and docs use American spelling', () => {
    // Built from parts, so this file does not trip its own check.
    const british = ['col' + 'our', 'behavi' + 'our', 'neighb' + 'our', 'fav' + 'our', 'hon' + 'our', 'cent' + 're', 'model' + 'ling', 'model' + 'led',
      '(?<!aria-)label' + 'led', 'cancel' + 'led', 'travel' + 'led', 'organi' + 's', 'recogni' + 's', 'summari' + 's', 'saniti' + 's', 'prioriti' + 's',
      'judge' + 'ment', 'analy' + 'se', 'catalog' + 'ue', 'licen' + 'ce'];
    const word = new RegExp(`\\b(?:${british.join('|')})`, 'i');
    const files = [
      ...filesUnder(SRC, /\.(tsx?|css)$/),
      ...filesUnder(join(ROOT, 'lathe', 'src'), /\.ts$/),
      ...filesUnder(join(ROOT, 'specs'), /\.md$/),
      ...['README.md', 'lathe/FORMAT.md', 'lathe/README.md'].map((f) => join(ROOT, f)),
    ];
    const hits = files.flatMap((f) => where(f, readFileSync(f, 'utf8'), word));
    expect(hits).toEqual([]);
  });
});
