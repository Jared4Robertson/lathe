import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { desktopBridgeStub, openApp } from './helpers';
import { REQUIRED_PAIRS, colorOf } from '../src/theme/audit';
import { contrast } from '../src/theme/contrast';
import { themeCss } from '../src/theme/css';
import { BUILT_IN_THEMES } from '../src/theme/theme';
import { COLOR_NAMES, SETTING_NAMES } from '../src/theme/tokens';
import { parseSpecRoute } from '../src/views/spec-route';
import { isRecordId } from '../src/views/address';
import { workspace } from './fixtures/workspace';
// The split view loads the graph, which needs a ResizeObserver in jsdom.
import './graph/setup';
import { recordIndexOf } from './read-view';
import { Card } from '../src/shell/Card';

// The app's standards (LA-PAT-APP-CODE and LA-PAT-APP-UX): each test proves one of the patterns' rules,
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

describe('LA-PAT-APP-CODE App code and LA-PAT-APP-UX App experience', () => {
  it('LA-PAT-APP-CODE-R01-T01 LA-PAT-APP-CODE-R01-T02 Layout lives in the markup: no stylesheet rule moves or restyles an element from outside its component', async () => {
    expect(where('app/src/styles.css', CSS, /display:\s*contents|:has\(/)).toEqual([]);
    // A section's own header row holds its list's Expand all: the button sits inside the header.
    await openApp('/DM-SHOP-CAP01');
    const children = (await screen.findByRole('heading', { level: 2, name: /^Use cases/ })).closest('section')!;
    const header = children.querySelector(':scope > header.spec-section-head')!;
    expect(header).not.toBeNull();
    const bulk = within(children).queryByRole('button', { name: /Expand all|Collapse all/ });
    if (bulk) expect(header.contains(bulk)).toBe(true);
  });

  it('LA-PAT-APP-UX-R13-T01 LA-PAT-APP-UX-R13-T02 No style title-cases a label word by word', () => {
    const sheets = [...filesUnder(join(ROOT, 'app/src'), /\.css$/), ...filesUnder(join(ROOT, 'desktop'), /\.(css|html)$/)];
    expect(sheets.flatMap((file) => where(file, readFileSync(file, 'utf8'), /text-transform:\s*capitalize/))).toEqual([]);
  });

  it('LA-PAT-APP-CODE-R02-T01 LA-PAT-APP-CODE-R02-T02 Styles are set by class: no selector names only elements, beyond the base styles', () => {
    const bare = styleRules(CSS)
      .flatMap((r) => topLevel(r.selector).map((s) => ({ s: s.trim(), line: r.line })))
      .filter(({ s }) => s !== ':root' && !/[.#[]/.test(s))
      .filter(({ s }) => !s.split(/[\s>+~]+/).every((part) => BASE_ELEMENTS.has(part.replace(/:{1,2}[\w-]+(\(.*?\))?/g, ''))))
      .map(({ s, line }) => `app/src/styles.css:${line}: ${s}`);
    expect(bare).toEqual([]);
  });

  it('LA-PAT-APP-CODE-R03-T01 LA-PAT-APP-CODE-R03-T02 Colors and shadows are tokens: color values appear only where :root defines them', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;
    const outside = styleRules(CSS)
      .filter((r) => r.selector !== ':root' && literal.test(r.body))
      .map((r) => `app/src/styles.css:${r.line}: ${r.selector}`);
    expect(outside).toEqual([]);
    // Inline styles in components set no colors either.
    const inline = filesUnder(SRC, /\.tsx$/).flatMap((f) => where(f, readFileSync(f, 'utf8'), /style=\{\{[^}]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\()/));
    expect(inline).toEqual([]);
  });

  it('LA-PAT-APP-CODE-R04-T01 LA-PAT-APP-CODE-R04-T02 Generic components know nothing of specs, the graph or the shell: they import only React, each other and the text helpers', () => {
    const imports = filesUnder(join(SRC, 'components'), /\.tsx?$/).flatMap((f) =>
      where(f, readFileSync(f, 'utf8'), /^import .* from '(?!react\b|react-dom\b|\.\/|\.\.\/plural')/),
    );
    expect(imports).toEqual([]);
  });

  it('LA-PAT-APP-CODE-R05-T01 LA-PAT-APP-CODE-R05-T02 Kind labels become plural only through plural() and lowercase only through lowerLabel()', () => {
    const naive = filesUnder(SRC, /\.tsx?$/)
      .filter((f) => !f.endsWith('plural.ts'))
      .flatMap((f) => where(f, readFileSync(f, 'utf8'), /\$\{[^}]*[lL]abel[^}]*\}s\b|[lL]abel\)?\s*\+\s*'s'|[lL]abel(?:\([^)]*\))?\.(?:charAt\(0\)\.)?toLowerCase\(\)/));
    expect(naive).toEqual([]);
  });

  it('LA-PAT-APP-CODE-R06-T01 LA-PAT-APP-CODE-R06-T02 Every button and link on the main pages has an accessible name', async () => {
    for (const path of ['/', '/DM-SHOP', '/DM-SHOP-UC01', '/DM-SHOP-UC01?stage=graph']) {
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

  it('LA-PAT-APP-UX-R01-T01 LA-PAT-APP-UX-R01-T02 Everything clickable shows a hover state: each pointer-cursor rule has a :hover rule for the same class', () => {
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

  it('LA-PAT-APP-UX-R02-T01 LA-PAT-APP-UX-R02-T02 The stage behind, the panels floating over it, inset and frosted, every panel edge the one ResizeHandle', async () => {
    for (const token of ['--shell:', '--float-inset:', '--panel-radius:', '--float-dense:', '--float-light:', '--float-shadow:']) expect(CSS).toContain(token);
    // One implementation: no other component draws a separator of its own.
    const separators = filesUnder(SRC, /\.tsx$/).filter((f) => !f.endsWith('ResizeHandle.tsx')).flatMap((f) => where(f, readFileSync(f, 'utf8'), /role="separator"/));
    expect(separators).toEqual([]);
    // On a record: the nav and the wiki card each have a handle at their edge.
    await openApp('/DM-SHOP-UC01?stage=graph');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // A focusable separator (one with a value) is a splitter; a plain divider line such as the rail's is not.
    const handles = screen.getAllByRole('separator').filter((h) => h.hasAttribute('aria-valuenow')).map((h) => [h.getAttribute('aria-label'), h.classList.contains('resize-handle')]);
    expect(handles).toEqual([['Resize the navigation', true], ['Resize the wiki card', true]]);
    // The stage fills the window behind; every panel floats over it, naming the side it sits on.
    const stage = screen.getByRole('region', { name: 'Graph stage' });
    expect(stage).toHaveClass('focus-stage');
    expect(stage.closest('[data-floating]')).toBeNull();
    for (const [panel, side] of [[document.querySelector('#nav'), 'left'], [document.querySelector('.wiki-panel'), 'right'], [document.querySelector('.header-strip'), 'top']] as const) {
      expect(panel).toHaveAttribute('data-floating', side);
    }
    expect(CSS).toMatch(/\.focus-stage \{ position: absolute; inset: 0; z-index: 0;/);
  });

  it('LA-PAT-APP-CODE-R10-T01 LA-PAT-APP-CODE-R10-T02 Every grid says its columns, a single column being minmax(0, 1fr), so content shrinks with its panel', () => {
    const unsized = styleRules(CSS)
      .filter((r) => /display:\s*(?:inline-)?grid/.test(r.body) && !/grid-template-columns/.test(r.body) && !/place-items/.test(r.body))
      .map((r) => `app/src/styles.css:${r.line}: ${r.selector}`);
    expect(unsized).toEqual([]);
  });

  it('LA-PAT-APP-UX-R03-T01 LA-PAT-APP-UX-R03-T02 The page bar holds the page\'s tabs and controls; a stage\'s own tools float in the open space, on wide and narrow screens alike', async () => {
    const host = window as unknown as { latheDesktop?: LatheDesktop };
    const cases = [['/DM-SHOP-UC01?stage=graph', false, false], ['/DM-SHOP-UC01?stage=erd', false, false], ['/DM-SHOP-UC01?stage=graph', false, true], ['/DM-SHOP-UC01?stage=graph', true, false], ['/DM-SHOP-UC01?stage=graph', true, true]] as const;
    for (const [path, narrow, desktop] of cases) {
      if (narrow) vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
      if (desktop) host.latheDesktop = desktopBridgeStub(); else delete host.latheDesktop;
      await openApp(path);
      await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
      // In the desktop app and on a phone, one page bar at the top of the tab panel; on the web, wide, none: the header
      // strip is the panel's one row and holds the page's controls. Either sits outside the stage and the wiki card.
      const bars = [...document.querySelectorAll<HTMLElement>('.page-bar')];
      expect(bars).toHaveLength(desktop || narrow ? 1 : 0);
      const bar = desktop || narrow ? bars[0] : document.querySelector<HTMLElement>('.header-strip')!;
      expect(bar.closest('.focus-stage, .wiki-panel')).toBeNull();
      // Its left: in the desktop app the tabs (on a phone, the Open pages control that opens them as a sheet); on the
      // web nothing, the browser's tabs being the places.
      if (!desktop) {
        expect(within(bar).queryByRole('button', { name: /^Open pages/ })).toBeNull();
        expect(screen.queryAllByRole('tablist')).toEqual([]);
      } else if (narrow) {
        expect(within(bar).getByRole('button', { name: /^Open pages: \d+$/ })).toBeInTheDocument();
        expect(screen.queryAllByRole('tablist')).toEqual([]);
      } else {
        expect(screen.getAllByRole('tablist')).toHaveLength(1);
        expect(bar.querySelector('.page-bar-start [role="tablist"]')).not.toBeNull();
      }
      // Its right: the stage switch, one pressed stage, then the wiki card toggle, last.
      const groups = screen.queryAllByRole('group', { name: 'Stage' });
      expect(groups).toHaveLength(1);
      expect(bar.contains(groups[0])).toBe(true);
      const stages = within(groups[0]).getAllByRole('button');
      for (const t of stages) expect(t).toHaveAttribute('aria-pressed');
      expect(stages.filter((t) => t.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
      const card = within(bar).getByRole('button', { name: /the wiki card$/ });
      const actions = [...bar.querySelectorAll('.page-bar-actions button')];
      expect(actions[actions.length - 1]).toBe(card);
      if (!narrow) for (const t of stages) expect(t).toHaveClass('icon-button');
      // No panes and no pane headers: a stage's own controls float as its tools, inside the stage, never in the page bar.
      expect(document.querySelector('.pane, .pane-bar')).toBeNull();
      await waitFor(() => expect(document.querySelectorAll('.focus-stage [data-stage-tools]').length).toBeGreaterThan(0));
      const tools = document.querySelectorAll<HTMLElement>('.focus-stage [data-stage-tools]');
      for (const t of tools) expect(bar.contains(t)).toBe(false);
      // The page's title is the header strip's, under the page bar.
      expect(screen.getByRole('heading', { level: 1 }).closest('.header-strip')).not.toBeNull();
    }
    delete host.latheDesktop;
    // The page bar and the header strip keep one height whatever they hold; on the web the strip is as high as a page bar.
    expect(CSS).toMatch(/\.page-bar \{[^}]*height: var\(--page-bar-height\)/);
    expect(CSS).toMatch(/\.stage-layout\.one-place:not\(\.is-phone\) \.header-strip \{[^}]*height: var\(--page-bar-height\)/);
    expect(CSS).toMatch(/\.header-strip \{[^}]*height: var\(--strip-height\)/);
  });

  it('LA-V96-R04-T03 Graph, ERD and Trace are pressed buttons of the stage switch in the page bar, one pressed, its stage the one drawn', async () => {
    await openApp('/DM-SHOP-UC01?stage=trace');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const buttons = within(screen.getByRole('group', { name: 'Stage' })).getAllByRole('button');
    expect(buttons.map((t) => [t.getAttribute('aria-label'), t.getAttribute('aria-pressed')])).toEqual([['Graph', 'false'], ['ERD', 'false'], ['Trace', 'true']]);
    expect(screen.getByRole('region', { name: 'Trace stage' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^(Graph|ERD) stage$/ })).toBeNull();
  });

  it('LA-PAT-APP-UX-R04-T01 Motion is shared and optional: every transition and animation uses the motion or hover tokens and is turned off under reduced motion', () => {
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
    // Code that animates frame by frame takes its timing from the shared motion, not numbers of its own: directly, or
    // through the canvas look, whose fade is the motion's duration.
    expect(readFileSync(join(SRC, 'graph', 'look.ts'), 'utf8')).toMatch(/fade = readMotion\(\)\.duration/);
    const ownTiming = animators.filter((f) => !/readMotion\(\)|readLook\(/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(ownTiming).toEqual([]);
  });

  it('LA-PAT-APP-CODE-R15-T01 LA-PAT-APP-CODE-R15-T02 Themes only set tokens: a theme file holds token names only, its stylesheet sets them on :root, and every built-in passes AA for text in both modes', () => {
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

  it('LA-PAT-APP-UX-R05-T01 LA-PAT-APP-UX-R05-T02 A row that leads to one record is one link: every record row on the domain and record pages has exactly one row link, stretched over the row', async () => {
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
  });

  it('LA-PAT-APP-UX-R14-T01 LA-PAT-APP-UX-R14-T02 A card has one primary action, taken by clicking anywhere on it: every card is the Card component, its title a link or button stretched over it', async () => {
    // One way to build a card: the Card component requires its primary action, so a card without one does not compile.
    // @ts-expect-error a card with neither an href nor an onActivate is refused
    expect(<Card title="A dead box" />).toBeTruthy();
    // No element outside the component uses the card classes, in the app or the desktop app's pages.
    const cardFile = join(SRC, 'shell', 'Card.tsx');
    const cardClass = /\b(?:[\w-]+-)?cards?(?:-[\w-]+)?\b/;
    const outside = [
      ...filesUnder(SRC, /\.tsx?$/).filter((f) => f !== cardFile).flatMap((f) => where(f, readFileSync(f, 'utf8'), new RegExp(`className=[^>]*?${cardClass.source}`))),
      ...filesUnder(join(ROOT, 'desktop', 'static'), /\.html$/).flatMap((f) => where(f, readFileSync(f, 'utf8'), new RegExp(`class=[^>]*?${cardClass.source}`))),
    ];
    expect(outside).toEqual([]);
    // Every card class in the stylesheets is one the component sets.
    const own = new Set(readFileSync(cardFile, 'utf8').match(/\bcard(?:-[\w]+)?\b/g));
    const sheets = [...filesUnder(SRC, /\.css$/), ...filesUnder(join(ROOT, 'desktop', 'static'), /\.html$/)];
    const strangers = sheets.flatMap((f) => where(f, readFileSync(f, 'utf8'), /\.(?:[\w-]+-)?cards?(?:-[\w-]+)?\b/)
      .filter((hit) => (hit.match(/\.[\w-]*card[\w-]*/g) ?? []).some((c) => !own.has(c.slice(1)))));
    expect(strangers).toEqual([]);
    // The stylesheet: the title's ::after covers the positioned card and shows its hover and focus; one rule lifts the
    // card's other controls above it; the title takes the pointer.
    const rules = styleRules(CSS);
    const ruleFor = (test: (selector: string) => boolean) => rules.filter((r) => topLevel(r.selector).some((s) => test(s.trim())));
    expect(ruleFor((s) => s === '.card').map((r) => r.body).join(';')).toMatch(/position:\s*relative/);
    expect(ruleFor((s) => s === '.card-title::after').map((r) => r.body).join(';')).toMatch(/position:\s*absolute[\s\S]*inset:/);
    expect(ruleFor((s) => s === '.card-title:hover::after').map((r) => r.body).join(';')).toContain('var(--hover-ring)');
    expect(ruleFor((s) => s === '.card-title:focus-visible::after').map((r) => r.body).join(';')).toMatch(/outline:/);
    expect(ruleFor((s) => s === '.card .card-title').map((r) => r.body).join(';')).toMatch(/cursor:\s*pointer/);
    expect(ruleFor((s) => /^\.card :is\(.*\bbutton\b.*\):not\(\.card-title\)$/.test(s)).map((r) => r.body).join(';')).toMatch(/position:\s*relative[\s\S]*z-index:\s*1/);
    // Every card on the products, product, checks, record, Trace and Appearance pages: one primary action, its title, a real link or a
    // button with a name; and every problem row, the record's or else its check's, is never a dead box.
    let cards = 0;
    let problems = 0;
    for (const path of ['/', '/DM', '/DM?panel=checks', '/DM-SHOP-UC01-R01-T01', '/DM-SHOP-UC01-R01?stage=trace', '/DM?panel=appearance']) {
      await openApp(path);
      await screen.findByRole('heading', { level: 1 });
      // The Trace stage loads on its own: its chain's cards.
      if (path.includes('trace')) await screen.findByRole('list', { name: 'Obligation' });
      const wrong = [...document.querySelectorAll<HTMLElement>('.card')].filter((card) => {
        cards += 1;
        const titles = card.querySelectorAll(':scope > .card-title');
        const title = titles[0];
        const acts = title && ((title.tagName === 'A' && /^\//.test(title.getAttribute('href') ?? '')) || (title.tagName === 'BUTTON' && !title.hasAttribute('disabled')));
        return titles.length !== 1 || !acts || !(title.getAttribute('aria-label') ?? title.textContent ?? '').trim();
      }).map((card) => `${path}: ${card.outerHTML.slice(0, 160)}`);
      expect(wrong).toEqual([]);
      const dead = [...document.querySelectorAll<HTMLElement>('.problems > li')].filter((row) => {
        problems += 1;
        return row.querySelectorAll('a.row-link').length !== 1;
      }).map((row) => `${path}: ${row.outerHTML.slice(0, 160)}`);
      expect(dead).toEqual([]);
    }
    expect(cards).toBeGreaterThan(0);
    expect(problems).toBeGreaterThan(0);
  });

  it('LA-PAT-RECORD-PAGE-R06-T01 Every record row on the domain and record pages has exactly one row link, a real link to a record', async () => {
    for (const path of ['/DM-SHOP', '/DM-SHOP-UC01', '/DM-SHOP-CMD01']) {
      await openApp(path);
      await screen.findByRole('heading', { level: 1 });
      const lists = [...document.querySelectorAll('.record-list')];
      expect(lists.length).toBeGreaterThan(0);
      const rowsOnPage = lists.flatMap((list) => [...list.querySelectorAll(':scope > li')].map((li) => (li.classList.contains('tree-item') ? li.querySelector(':scope > .tree-row')! : li)));
      const withLinks = rowsOnPage.filter((row) => row.querySelector('a.record-link'));
      expect(withLinks.length).toBeGreaterThan(0);
      const wrong = withLinks
        .filter((row) => row.querySelectorAll('.row-link').length !== 1 || !/^\/[A-Z]/.test(row.querySelector('.row-link')?.getAttribute('href') ?? ''))
        .map((row) => `${path}: ${row.outerHTML.slice(0, 160)}`);
      expect(wrong).toEqual([]);
    }
  });

  it('LA-PAT-APP-CODE-R07-T01 LA-PAT-APP-CODE-R07-T02 Code, specs and docs use American spelling', () => {
    // Built from parts, so this file does not trip its own check.
    const british = ['col' + 'our', 'behavi' + 'our', 'neighb' + 'our', 'fav' + 'our', 'hon' + 'our', 'cent' + 're', 'model' + 'ling', 'model' + 'led',
      '(?<!aria-)label' + 'led', 'cancel' + 'led', 'travel' + 'led', 'organi' + 's', 'recogni' + 's', 'summari' + 's', 'saniti' + 's', 'prioriti' + 's',
      'judge' + 'ment', 'analy' + 'se', 'catalog' + 'ue', 'licen' + 'ce'];
    const word = new RegExp(`\\b(?:${british.join('|')})`, 'i');
    const files = [
      ...filesUnder(SRC, /\.(tsx?|css)$/),
      ...filesUnder(join(ROOT, 'lathe', 'src'), /\.ts$/),
      ...filesUnder(join(ROOT, 'data'), /\.jsonl$/),
      ...['README.md', 'lathe/README.md'].map((f) => join(ROOT, f)),
    ];
    const hits = files.flatMap((f) => where(f, readFileSync(f, 'utf8'), word));
    expect(hits).toEqual([]);
  });

  /** Every clickable control is at least 44 x 44 px on a coarse pointer, as itself or through a target stretched around it. */
  const touchTargets = () => {
    const rules = styleRules(CSS);
    const coarse = (r: { within: string[] }) => r.within.some((w) => /pointer:\s*coarse/.test(w));
    expect(CSS).toMatch(/--touch-target:\s*44px/);
    // The class a selector targets: the last class in it, before any pseudo-element.
    const keyOf = (s: string) => { const classes = s.replace(/::[\w-]+/g, '').match(/\.[\w-]+/g); return classes?.[classes.length - 1] ?? null; };
    const sized = (body: string) => /min-height:\s*var\(--touch-target\)|height:\s*var\(--touch-target\)/.test(body);
    // Covered: a coarse-pointer rule sizes the control or its stretched ::before, or its own rule is touch-sized everywhere.
    const covered = new Set(rules
      .filter((r) => (coarse(r) && (sized(r.body) || /--nav-row-height:\s*var\(--touch-target\)/.test(r.body))) || (!coarse(r) && sized(r.body)))
      .flatMap((r) => topLevel(r.selector).flatMap((s) => {
        const inner = s.match(/^\s*:is\(([\s\S]*)\)(::before)?\s*$/);
        return (inner ? topLevel(inner[1]) : [s]).map((x) => keyOf(x.trim()));
      }))
      .filter(Boolean));
    // The nav's rows take their height from --nav-row-height, which the coarse pointer sets to the touch target.
    for (const k of ['.nav-row', '.nav-chevron', '.nav-folder-head', '.nav-section-head']) covered.add(k);
    // Canvas nodes are sized by the layout and grow with pinch-zoom; a card's title is stretched over the whole card.
    const exempt = new Set(['.graph-node', '.erd-box', '.card-title']);
    const missing = rules
      .filter((r) => !coarse(r) && /cursor:\s*pointer/.test(r.body))
      .flatMap((r) => topLevel(r.selector).map((s) => ({ key: keyOf(s.trim()), s: s.trim(), line: r.line })))
      .filter(({ key }) => key && !covered.has(key) && !exempt.has(key))
      .map(({ s, line }) => `app/src/styles.css:${line}: ${s}`);
    expect(missing).toEqual([]);
    // Small controls inside a row or a node keep their look and get a target stretched around them.
    expect(CSS).toMatch(/:is\([^)]*\.tree-toggle[^)]*\)::before\s*\{[^}]*width:\s*var\(--touch-target\);\s*height:\s*var\(--touch-target\)/);
  };

  it('LA-V61-R19-T02 LA-V61-R26-T01 LA-PAT-APP-UX-R07-T01 LA-PAT-APP-UX-R07-T02 Everything works by touch: on a coarse pointer every clickable control is at least 44 x 44 px, as itself or through a target stretched around it', touchTargets);

  it('LA-PAT-APP-UX-R07-T01 LA-PAT-APP-UX-R07-T02 Nothing is reachable only by hover: a control a hover reveals is always shown on a coarse pointer, and every tooltip also shows on keyboard focus', () => {
    const rules = styleRules(CSS);
    const coarse = (r: { within: string[] }) => r.within.some((w) => /pointer:\s*coarse/.test(w));
    const keyOf = (s: string) => { const classes = s.replace(/:[\w-]+(\([^)]*\))?/g, '').match(/\.[\w-]+/g); return classes?.[classes.length - 1] ?? null; };
    // Rules a hover turns on: they show something (opacity 1, visible, or a display other than none).
    const reveals = rules
      .filter((r) => !coarse(r) && /:hover/.test(r.selector) && /opacity:\s*1\b|visibility:\s*visible|display:\s*(?!none)/.test(r.body))
      .flatMap((r) => topLevel(r.selector).filter((s) => s.includes(':hover')).map((s) => ({ key: keyOf(s.trim().split(/\s+/).pop()!), s: s.trim(), line: r.line })));
    const shownOnTouch = new Set(rules.filter((r) => coarse(r) && /opacity:\s*1\b|visibility:\s*visible/.test(r.body)).flatMap((r) => topLevel(r.selector).map((s) => keyOf(s.trim()))));
    const hoverOnly = reveals.filter(({ key }) => key && !shownOnTouch.has(key)).map(({ s, line }) => `app/src/styles.css:${line}: ${s}`);
    expect(hoverOnly).toEqual([]);
    // Tooltips name a control that already has its accessible name; they open on focus as well as hover.
    const tooltip = readFileSync(join(SRC, 'shell', 'Tooltip.tsx'), 'utf8');
    expect(tooltip).toMatch(/onFocus/);
  });

  it('LA-V61-R17-T02 No page scrolls sideways at 320 px: no fixed width in the stylesheet is wider than the phone\'s content', async () => {
    // What jsdom cannot do: lay pages out. So this reads the stylesheet for any fixed least width over 288 px (320 px less
    // the 16 px gutters) outside a wide-screen media query, and renders the main pages on a phone to check that every
    // table and code block sits in a box that scrolls sideways and no inline style fixes a width over 288 px.
    // The real layout at 320 px and 375 px is checked in a browser (notes/mobile-design.md).
    const rules = styleRules(CSS);
    const wideOnly = (r: { within: string[] }) => r.within.some((w) => /min-width:\s*\d+px/.test(w));
    const tooWide = rules
      .filter((r) => !wideOnly(r))
      .flatMap((r) => {
        const fixed = [...r.body.matchAll(/(?:^|;)\s*(min-width|width|flex-basis)\s*:\s*(\d+)px/g)].map((m) => Number(m[2]));
        const mins = [...r.body.matchAll(/minmax\(\s*(\d+)px/g)].map((m) => Number(m[1]));
        const floors = /max-width:/.test(r.body) ? [] : [...r.body.matchAll(/(?:^|;)\s*width\s*:\s*max\([^;]*?(\d+)px/g)].map((m) => Number(m[1]));
        return [...fixed, ...mins, ...floors].some((n) => n > 288) ? [`app/src/styles.css:${r.line}: ${r.selector}`] : [];
      });
    expect(tooWide).toEqual([]);
  });

  it('LA-V61-R24-T01 On a phone, tables and code blocks scroll in their own box, IDs wrap, and no inline style fixes a width wider than the screen', async () => {
    // Tables and code blocks scroll in their own box.
    expect(CSS).toMatch(/\.markdown table \{[^}]*display:\s*block;[^}]*overflow-x:\s*auto/);
    expect(CSS).toMatch(/\.table-scroll \{[^}]*overflow-x:\s*auto/);
    expect(CSS).toMatch(/\.markdown pre, \.spec-body pre \{[^}]*overflow-x:\s*auto/);
    expect(CSS).toMatch(/\.record-id[^{]*\{[^}]*overflow-wrap:\s*anywhere/);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    for (const path of ['/DM', '/DM-SHOP', '/DM-SHOP-UC01', '/DM-SHOP-CMD01-H', '/DM?panel=checks', '/DM?page=format']) {
      await openApp(path);
      await screen.findAllByRole('heading', { level: 1 });
      const loose = [...document.querySelectorAll('table')].filter((t) => !t.closest('.table-scroll') && !t.closest('.markdown') && !t.matches('.erd-key-table, .shortcut-table'));
      expect(loose.map((t) => `${path}: ${t.outerHTML.slice(0, 120)}`)).toEqual([]);
      const code = [...document.querySelectorAll('pre')].filter((p) => !p.closest('.markdown, .spec-body'));
      expect(code.map((p) => `${path}: ${p.outerHTML.slice(0, 120)}`)).toEqual([]);
      const fixed = [...document.querySelectorAll<HTMLElement>('[style]')].filter((el) => /(?:^|;)\s*(?:min-)?width:\s*(\d{3 })px/.test(el.getAttribute('style') ?? '') && Number(/(\d{3 })px/.exec(el.getAttribute('style')!)![1]) > 288);
      expect(fixed.map((el) => `${path}: ${el.outerHTML.slice(0, 120)}`)).toEqual([]);
    }
  });

  it('LA-PAT-APP-UX-R09-T01 LA-PAT-APP-UX-R09-T02 Actions look like actions: standalone actions are the one Button, and links stay links for navigation in context', async () => {
    // The controls that are not standalone actions, and so keep their own form: tab close buttons, toggles in a group,
    // fold chevrons, the nav's rows and rail, the sheet handle, the open-pages list, the title bar's command center and a
    // card's title, stretched over its card (LA-PAT-APP-UX-R14), and the chat's session rows and tool rows.
    // In the source no raw <button> may take the Button's own classes; on the page they are allowed.
    const ALLOWED = ['tab-close', 'tree-toggle', 'nav-chevron', 'nav-row', 'nav-folder-head', 'nav-section-head', 'rail-item',
      'view-segment', 'page-bar-pages', 'pages-open', 'sheet-handle', 'command-center', 'card-title',
      'chat-session-open', 'chat-tool-row'];
    const allowed = `.button, .icon-button, ${ALLOWED.map((c) => `.${c}`).join(', ')}, [role="group"] button[aria-pressed]`;

    // The source: no old button styles, and every raw <button> outside Button.tsx is one of the allowed controls
    // (an unclassed one only as a toggle, with aria-pressed). Only a toggle in a group, which takes the icon look on a wide
    // screen and a segment's on a phone, may borrow the icon-button class.
    const files = filesUnder(SRC, /\.(tsx?|css)$/);
    expect(files.flatMap((f) => where(f, readFileSync(f, 'utf8'), /tree-bulk|className="secondary"|button\.secondary/))).toEqual([]);
    const raw = files.filter((f) => f.endsWith('.tsx') && !f.endsWith(join('components', 'Button.tsx'))).flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return [...text.matchAll(/<button\b/g)].flatMap((m) => {
        // The opening tag: up to the first '>' outside braces.
        let depth = 0;
        let end = m.index;
        for (; end < text.length; end++) {
          const c = text[end];
          if (c === '{') depth++;
          else if (c === '}') depth--;
          else if (c === '>' && depth === 0) break;
        }
        const tag = text.slice(m.index, end);
        const cls = /className=(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s+[\w-]+=|\s*\/?$))/.exec(tag);
        const words = cls ? (cls[1] ?? cls[2]).match(/[\w-]+/g) ?? [] : [];
        const borrows = words.some((w) => w === 'button' || w === 'icon-button' || w.startsWith('button-'));
        const ok = (cls ? words.some((w) => ALLOWED.includes(w)) : /aria-pressed/.test(tag)) && (!borrows || /aria-pressed/.test(tag));
        return ok ? [] : [`${relative(ROOT, f)}:${text.slice(0, m.index).split('\n').length}: ${tag.replace(/\s+/g, ' ').slice(0, 100)}`];
      });
    });
    expect(raw).toEqual([]);

    // The pages.
    for (const path of ['/', '/DM', '/DM-SHOP', '/DM-SHOP-UC01', '/DM-SHOP-UC01?stage=graph', '/DM?panel=checks', '/DM?page=format', '/DM?panel=appearance']) {
      await openApp(path);
      // Every page waits for its content.
      await screen.findAllByRole('heading', { level: 1 });
      expect(document.querySelectorAll('button.secondary, .tree-bulk').length).toBe(0);
      const stray = [...document.querySelectorAll('button')].filter((b) => !b.matches(allowed)).map((b) => `${path}: ${b.outerHTML.slice(0, 140)}`);
      expect(stray).toEqual([]);
      // A link alone in its paragraph is a standalone action, so it is drawn as a button; a record's own ID line is a reference.
      const lone = [...document.querySelectorAll('p:not(.record-id) > a:only-child')]
        .filter((a) => a.parentElement!.textContent!.trim() === a.textContent!.trim() && !a.classList.contains('button'))
        .map((a) => `${path}: ${a.parentElement!.outerHTML.slice(0, 140)}`);
      expect(lone).toEqual([]);
    }
  });

  it('LA-PAT-APP-CODE-R19-T01 LA-PAT-APP-CODE-R19-T02 One address per thing: only address.ts makes a record or group address, and every address is an ID or a lowercase app page', async () => {
    // The source: no path built by hand under the old prefixes, or from an ID, outside address.ts (the desktop menus included).
    const sources = [...filesUnder(SRC, /\.tsx?$/), ...filesUnder(join(ROOT, 'desktop', 'src'), /\.ts$/)]
      .filter((f) => !f.endsWith(join('views', 'address.ts')));
    const handBuilt = sources.flatMap((f) => where(f, readFileSync(f, 'utf8'), /[`'"]\/(records|specs|graph)\b|`\/\$\{/));
    expect(handBuilt).toEqual([]);

    const index = recordIndexOf(workspace());
    expect(parseSpecRoute('/', index)).toEqual({ page: 'specs' });
    for (const id of ['DM', 'DM-SHOP', 'DM-SHOP-UC01']) expect(parseSpecRoute(`/${id}`, index)?.page, id).toMatch(/^(product|domain|record)$/);
    expect(parseSpecRoute('/DM-SHOP/interaction-design/flow', index)).toEqual({ page: 'group', parent: 'DM-SHOP', kind: 'interaction-design/flow' });

    // The pages: every in-app link is the home page or an ID, a tool over the stage in its query, and none is an old address.
    for (const path of ['/', '/DM', '/DM-SHOP', '/DM-SHOP-UC01', '/DM-SHOP/interaction-design/flow?stage=graph', '/DM?panel=checks', '/DM-SHOP-UC01?page=format', '/DM?panel=appearance']) {
      await openApp(path);
      await screen.findAllByRole('heading', { level: 1 });
      const wrong = [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')!).filter((href) => {
        const first = decodeURIComponent(href.split(/[?#]/)[0].split('/')[1] ?? '');
        return !(first === '' || isRecordId(first));
      });
      expect(wrong.map((href) => `${path}: ${href}`)).toEqual([]);
    }
  });

  it('LA-V96-R03-T02 An old address is no page: /records, /specs and /graph addresses say so, and the address stays as typed', async () => {
    for (const path of ['/records/DM-SHOP-UC01', '/records/DM-SHOP/use_case', '/specs', '/specs/DM/DM-SHOP', '/graph', '/graph/DM-SHOP-UC01', '/format', '/format/kinds/use_case', '/settings/appearance']) {
      expect(parseSpecRoute(path, recordIndexOf(workspace())), path).toEqual({ page: 'missing' });
      await openApp(path);
      expect(await screen.findByText(/There's no such page\./), path).toBeInTheDocument();
      expect(window.location.pathname, path).toBe(path);
    }
    // The old view query names nothing: the page opens on the stage last used, the graph at first.
    await openApp('/DM-SHOP-UC01?view=trace');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Trace stage' })).toBeNull();
  });

  describe('LA-STD-PRINCIPLES-R04-T01 changes are hard cutovers', () => {
    it('LA-PAT-APP-CODE-R20-T01 LA-PAT-APP-CODE-R20-T02 Changes are hard cutovers: no redirect, alias, legacy path or second addressOf signature in the app or the engine', () => {
      const sources = [...filesUnder(SRC, /\.(tsx?|css)$/), ...filesUnder(join(ROOT, 'lathe', 'src'), /\.ts$/)];
      const kept = sources.flatMap((f) => where(f, readFileSync(f, 'utf8'), /legacy|redirect|\balias(?!:\s*string|})/i));
      expect(kept).toEqual([]);
      // One addressOf, taking the ID alone: a second signature (an overload or another declaration) is a compatibility layer.
      const signatures = sources.flatMap((f) => where(f, readFileSync(f, 'utf8'), /function addressOf\b|\baddressOf\s*[:=]/));
      expect(signatures.map((s) => s.replace(/^.*?:\d+: /, ''))).toEqual(['export function addressOf(id: string): string {']);
    });
  });
});
