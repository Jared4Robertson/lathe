import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from './helpers';
import { REQUIRED_PAIRS, colorOf } from '../src/theme/audit';
import { contrast } from '../src/theme/contrast';
import { themeCss } from '../src/theme/css';
import { BUILT_IN_THEMES } from '../src/theme/theme';
import { COLOR_NAMES, SETTING_NAMES } from '../src/theme/tokens';
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

/** Every style rule in the stylesheet, with its selectors, its line and the at-rules it sits in (`within`, such as a media query). */
function styleRules(css: string): { selector: string; body: string; line: number; within: string[] }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const rules: { selector: string; body: string; line: number; within: string[] }[] = [];
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
        rules.push({ selector: head, body: text.slice(i + 1, end), line: text.slice(0, i).split('\n').length, within: stack.slice(0, -1) });
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
    // On a record with the wiki and graph open and the inspector shown: nav, wiki, graph and inspector, each gap a handle.
    await openApp('/records/DM-SHOP-UC01?view=wiki,graph');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // A focusable separator (one with a value) is a splitter; a plain divider line such as the rail's is not.
    const handles = screen.getAllByRole('separator').filter((h) => h.hasAttribute('aria-valuenow')).map((h) => [h.getAttribute('aria-label'), h.classList.contains('resize-handle')]);
    expect(handles).toEqual([['Resize the navigation', true], ['Resize the wiki and graph panes', true], ['Resize the inspector', true]]);
    for (const panel of [document.querySelector('#nav'), ...document.querySelectorAll('.pane'), document.querySelector('.inspector-column')]) expect(panel).toHaveClass('panel');
  });

  it('LA-BRW-T295 Every grid says its columns, a single column being minmax(0, 1fr), so content shrinks with its panel', () => {
    const unsized = styleRules(CSS)
      .filter((r) => /display:\s*(?:inline-)?grid/.test(r.body) && !/grid-template-columns/.test(r.body) && !/place-items/.test(r.body))
      .map((r) => `app/src/styles.css:${r.line}: ${r.selector}`);
    expect(unsized).toEqual([]);
  });

  it('LA-BRW-T298 Each pane has one title bar, the leftmost holding the tabs and the others naming their view, with the view toggles and layout actions as icon buttons, on wide and narrow screens alike', async () => {
    for (const [path, narrow] of [['/records/DM-SHOP-UC01?view=wiki', false], ['/records/DM-SHOP-UC01?view=wiki,graph', false], ['/records/DM-SHOP-UC01?view=wiki,graph', true]] as const) {
      // A narrow screen (under 900 px) stacks the panes; their bars hold the same controls.
      if (narrow) vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
      await openApp(path);
      await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
      const panes = [...document.querySelectorAll<HTMLElement>('.pane')];
      expect(panes.length).toBeGreaterThan(0);
      panes.forEach((pane, i) => {
        expect(pane).toHaveClass('panel');
        expect(pane.firstElementChild).toHaveClass('pane-bar');
        expect(pane.querySelectorAll(':scope > .pane-bar')).toHaveLength(1);
        if (i === 0) {
          // At the left of the leftmost pane, the tab strip, in place of the view's name.
          expect(pane.querySelector('.pane-bar > .pane-head > [role="tablist"]')).not.toBeNull();
          expect(pane.querySelector('.pane-name')).toBeNull();
        } else {
          // At the left of the others, a quiet label names the pane's view; it is not a control.
          const label = pane.querySelector('.pane-bar > .pane-head > .pane-name');
          expect(label?.textContent?.trim()).toMatch(/^(Wiki|Graph|Model)$/);
          expect(label?.querySelector('button, a, [tabindex]')).toBeNull();
        }
        // At the right, every control is an icon button in one style.
        for (const b of pane.querySelectorAll('.pane-actions button')) expect(b).toHaveClass('icon-button');
      });
      // One tab strip on the page, its tabs inside a title bar.
      expect(screen.getAllByRole('tablist')).toHaveLength(1);
      for (const t of screen.getAllByRole('tab')) expect(t.closest('.pane-bar')).not.toBeNull();
      // The view toggles: icon buttons with a pressed state, once, in the rightmost pane's bar, one pressed per open pane.
      const groups = screen.queryAllByRole('group', { name: 'View' });
      expect(groups).toHaveLength(1);
      expect(groups[0].closest('.pane')).toBe(panes[panes.length - 1]);
      const toggles = groups.flatMap((g) => within(g).getAllByRole('button'));
      for (const t of toggles) {
        expect(t.closest('.pane-actions')).not.toBeNull();
        expect(t).toHaveClass('icon-button');
        expect(t).toHaveAttribute('aria-pressed');
      }
      expect(toggles.filter((t) => t.getAttribute('aria-pressed') === 'true')).toHaveLength(panes.length);
      // Every view and layout control lives in a title bar.
      const controls = [
        ...toggles,
        ...screen.queryAllByRole('button', { name: /^Close the (wiki|graph|model) pane$|^Full screen|^Leave full screen/ }),
        screen.getByRole('button', { name: /the inspector$/, expanded: !narrow }),
      ];
      for (const c of controls) expect(c.closest('.pane-bar')).not.toBeNull();
      // No row of its own for any layout control, on a narrow screen either.
      expect(document.querySelector('.pane-narrow-actions')).toBeNull();
      // The title belongs to the content of a pane.
      expect(screen.getByRole('heading', { level: 1 }).closest('.pane')).not.toBeNull();
    }
  });

  it('LA-BRW-T304 Motion is shared and optional: every transition and animation uses the motion or hover tokens and is turned off under reduced motion', () => {
    const rules = styleRules(CSS);
    const reduce = (r: { within: string[] }) => r.within.some((w) => /prefers-reduced-motion:\s*reduce/.test(w));
    const onlyWithMotion = (r: { within: string[] }) => r.within.some((w) => /prefers-reduced-motion:\s*no-preference/.test(w));
    // The rules that move something (those inside a reduced-motion query only turn motion off).
    const moving = rules.filter((r) => !reduce(r) && /(^|;)\s*(transition|animation)[\w-]*\s*:/.test(r.body));
    // Every duration and easing comes from a token: no literal times or easing keywords.
    const literal = moving
      .filter((r) => {
        const values = [...r.body.matchAll(/(?:^|;)\s*(?:transition|animation)[\w-]*\s*:\s*([^;]*)/g)].map((m) => m[1]);
        return values.some((v) => /\d(ms|s)\b|\b(ease|ease-in|ease-out|ease-in-out|linear)\b|cubic-bezier/.test(v.replace(/var\([^)]*\)/g, '')) || !/var\(--(motion-[\w-]+|hover-speed)\)/.test(v));
      })
      .map((r) => `app/src/styles.css:${r.line}: ${r.selector}`);
    expect(literal).toEqual([]);
    // Every rule that moves is either turned off by a reduced-motion rule for the same selector, or only applies when motion is welcome.
    const stilled = new Set(rules.filter((r) => reduce(r) && /(transition|animation)\s*:\s*none/.test(r.body)).flatMap((r) => topLevel(r.selector).map((s) => s.trim().replace(/\s+/g, ' '))));
    const uncovered = moving
      .filter((r) => !onlyWithMotion(r))
      .flatMap((r) => topLevel(r.selector).map((s) => ({ s: s.trim().replace(/\s+/g, ' '), line: r.line })))
      .filter(({ s }) => !stilled.has(s))
      .map(({ s, line }) => `app/src/styles.css:${line}: ${s}`);
    expect(uncovered).toEqual([]);
    // The tokens are defined, and the JS motion reads them and checks for reduced motion.
    for (const token of ['--motion-speed', '--motion-ease', '--hover-speed']) expect(CSS).toMatch(new RegExp(`${token}:`));
    const animators = filesUnder(SRC, /\.tsx?$/).filter((f) => /requestAnimationFrame\(/.test(readFileSync(f, 'utf8')));
    expect(animators.length).toBeGreaterThan(0);
    const motion = readFileSync(join(SRC, 'graph', 'motion.ts'), 'utf8');
    expect(motion).toContain("'(prefers-reduced-motion: reduce)'");
    expect(motion).toMatch(/--motion-speed[\s\S]*--motion-ease/);
    // Code that animates frame by frame takes its timing from the shared motion, not numbers of its own.
    const ownTiming = animators.filter((f) => !/readMotion\(\)/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(ownTiming).toEqual([]);
  });

  it('LA-BRW-T426 Themes only set tokens: a theme file holds token names only, its stylesheet sets them on :root, and every built-in passes AA for text in both modes', () => {
    const dir = join(SRC, 'theme', 'themes');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(BUILT_IN_THEMES.length);
    // Every name a theme file sets is a token the stylesheet's :root defines, and nothing else.
    const rootTokens = new Set(styleRules(CSS).filter((r) => r.selector === ':root').flatMap((r) => [...r.body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])));
    const notTokens = files.flatMap((f) => {
      const file = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
      const extra = Object.keys(file).filter((k) => !['format', 'version', 'name', 'light', 'dark', 'tokens'].includes(k)).map((k) => `${f}: ${k}`);
      const names = ['light', 'dark', 'tokens'].flatMap((set) => Object.keys((file[set] ?? {}) as object).map((n) => ({ set, n })));
      return [...extra, ...names.filter(({ set, n }) => !rootTokens.has(n) || (set === 'tokens' ? !SETTING_NAMES.has(n) : !COLOR_NAMES.has(n))).map(({ set, n }) => `${f}: ${set}.${n}`)];
    });
    expect(notTokens).toEqual([]);
    // A theme's stylesheet has no selector but :root, and sets only custom properties (and the color scheme).
    for (const theme of BUILT_IN_THEMES) {
      const rules = styleRules(themeCss(theme));
      expect(rules.map((r) => r.selector)).toEqual([':root[data-theme]', ':root[data-theme]:not([data-mode="light"])', ':root[data-theme][data-mode="dark"]']);
      const declarations = rules.flatMap((r) => r.body.split(';').map((d) => d.trim()).filter(Boolean));
      expect(declarations.filter((d) => !/^--[\w-]+:/.test(d) && !/^color-scheme: (light|dark)$/.test(d))).toEqual([]);
    }
    // Body text, muted text and the accent pass AA (4.5:1) on the page and on a sheet, for every built-in in both modes.
    const failing = BUILT_IN_THEMES.flatMap((theme) => (['light', 'dark'] as const).flatMap((mode) => REQUIRED_PAIRS.flatMap(([fg, bg]) => {
      const ratio = contrast(colorOf(theme, mode, fg)!, colorOf(theme, mode, bg)!);
      return ratio >= 4.5 ? [] : [`${theme.id} ${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`];
    })));
    expect(failing).toEqual([]);
  });

  it('LA-BRW-T400 A row that leads to one record is one link: every record row on the domain and record pages has exactly one row link, stretched over the row', async () => {
    // The stylesheet: rows are positioned, the row link's ::after covers the row and shows its hover
    // and focus, and one rule lifts the row's other controls above it.
    const rules = styleRules(CSS);
    const ruleFor = (test: (selector: string) => boolean) => rules.filter((r) => topLevel(r.selector).some((s) => test(s.trim())));
    const stretch = ruleFor((s) => s === '.row-link::after');
    expect(stretch.map((r) => r.body).join(';')).toMatch(/position:\s*absolute[\s\S]*inset:\s*0/);
    const rows = ruleFor((s) => /\.record-list > li/.test(s) && /\.tree-row/.test(s) && !/:not\(\.row-link\)/.test(s));
    expect(rows.map((r) => r.body).join(';')).toMatch(/position:\s*relative/);
    const lifted = ruleFor((s) => /:not\(\.row-link\)$/.test(s) && /\bbutton\b/.test(s) && /\ba\b/.test(s) && /\[title\]/.test(s));
    expect(lifted.map((r) => r.body).join(';')).toMatch(/position:\s*relative[\s\S]*z-index:\s*1/);
    expect(ruleFor((s) => s === '.row-link:hover::after').map((r) => r.body).join(';')).toContain('var(--hover-bg)');
    expect(ruleFor((s) => s === '.row-link:focus-visible::after').map((r) => r.body).join(';')).toMatch(/outline:/);

    // The pages: each row that holds a record link has exactly one row link, a real link to a record.
    for (const path of ['/specs/DM/DM-SHOP', '/records/DM-SHOP-UC01', '/records/DM-SHOP']) {
      await openApp(path);
      await screen.findByRole('heading', { level: 1 });
      const lists = [...document.querySelectorAll('.record-list')];
      expect(lists.length).toBeGreaterThan(0);
      const rowsOnPage = lists.flatMap((list) => [...list.querySelectorAll(':scope > li')].map((li) => (li.classList.contains('tree-item') ? li.querySelector(':scope > .tree-row')! : li)));
      const withLinks = rowsOnPage.filter((row) => row.querySelector('a.record-link'));
      expect(withLinks.length).toBeGreaterThan(0);
      const wrong = withLinks
        .filter((row) => row.querySelectorAll('.row-link').length !== 1 || !/^\/records\//.test(row.querySelector('.row-link')?.getAttribute('href') ?? ''))
        .map((row) => `${path}: ${row.outerHTML.slice(0, 160)}`);
      expect(wrong).toEqual([]);
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
