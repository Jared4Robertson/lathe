import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';
import { auditContrast } from '../src/theme/audit';
import { themeCss } from '../src/theme/css';
import { APPEARANCE_KEYS as STORAGE_KEYS } from '../src/platform/appearance/repository';
import { BUILT_IN_THEMES, parseTheme, toFile } from '../src/theme/theme';

// Themes (LA-PLT-UC07): choosing one with a live preview, the mode, the Appearance page and its
// editor, files in and out, and the theme on the page before first paint.

const press = (key: string, code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  fireEvent.keyDown(document.body, { key, code, ...mods });
const root = () => document.documentElement;
const themeStyle = () => document.getElementById('lathe-theme')?.textContent ?? '';
const stored = (key: string) => window.localStorage.getItem(key);

describe('themes', () => {
  it('LA-V63-R01-T01 Color theme (g then t) shows each theme as it is arrowed to, and Escape puts back the one before', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // Lathe and System at first, already written as the stylesheet the early script reads.
    expect(root().getAttribute('data-theme')).toBe('lathe');
    expect(root().hasAttribute('data-mode')).toBe(false);
    expect(stored(STORAGE_KEYS.css)).toBe(themeCss(BUILT_IN_THEMES[0]));

    press('g', 'KeyG');
    press('t', 'KeyT');
    const picker = await screen.findByRole('dialog', { name: 'Color theme' });
    const input = within(picker).getByRole('combobox');
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['LatheBuilt in', 'High contrastBuilt in', 'WorkshopBuilt in', 'MidnightBuilt in', 'GraphiteBuilt in']);
    expect(within(picker).getByRole('option', { selected: true })).toHaveTextContent('Lathe');

    // Arrowing previews at once, without keeping it.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(root().getAttribute('data-theme')).toBe('workshop');
    expect(themeStyle()).toBe(themeCss(BUILT_IN_THEMES[2]));
    expect(JSON.parse(stored(STORAGE_KEYS.chosen)!)).toBe('lathe');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root().getAttribute('data-theme')).toBe('lathe');
    expect(themeStyle()).toBe(themeCss(BUILT_IN_THEMES[0]));
  });

  it('LA-V61-R06-T01 A theme chosen with Enter applies at once and is remembered with its stylesheet', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // Typing filters; Enter keeps it, and it is remembered with its stylesheet.
    press('g', 'KeyG');
    press('t', 'KeyT');
    const again = within(await screen.findByRole('dialog', { name: 'Color theme' })).getByRole('combobox');
    fireEvent.change(again, { target: { value: 'mid' } });
    fireEvent.keyDown(again, { key: 'ArrowDown' });
    fireEvent.keyDown(again, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root().getAttribute('data-theme')).toBe('midnight');
    expect(JSON.parse(stored(STORAGE_KEYS.chosen)!)).toBe('midnight');
    expect(stored(STORAGE_KEYS.css)).toBe(themeCss(BUILT_IN_THEMES[3]));
    await waitFor(() => expect(screen.getByTestId('announcer')).toHaveTextContent('Color theme: Midnight'));
  });

  it('LA-V63-R02-T01 Light, dark or system is a command; it applies at once and is remembered', async () => {
    const user = userEvent.setup();
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    press('P', 'KeyP', { ctrlKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    await user.type(within(palette).getByRole('combobox'), 'light, dark');
    await user.keyboard('{Enter}');
    const picker = await screen.findByRole('dialog', { name: 'Light, dark or system' });
    const input = within(picker).getByRole('combobox');
    expect(within(picker).getAllByRole('option').map((o) => o.textContent?.replace(/Follows.*/, ''))).toEqual(['System', 'Light', 'Dark']);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(root().getAttribute('data-mode')).toBe('dark');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(root().getAttribute('data-mode')).toBe('dark');
    expect(JSON.parse(stored(STORAGE_KEYS.mode)!)).toBe('dark');

    // The dark set applies under data-mode="dark" whatever the system says, and the light set never wins it back.
    expect(themeStyle()).toContain(':root[data-theme][data-mode="dark"] { --shell: #0A0F12;');
    expect(themeStyle()).toContain('@media (prefers-color-scheme: dark) { :root[data-theme]:not([data-mode="light"])');
  });

  it('LA-V62-R01-T01 The Appearance page, linked from the nav, offers light, dark or system too', async () => {
    window.localStorage.setItem(STORAGE_KEYS.mode, JSON.stringify('dark'));
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // The same choice in Appearance, a popover over the stage from its button at the foot of the nav.
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Appearance' }));
    expect(window.location.pathname + window.location.search).toBe('/DM?panel=appearance');
    await screen.findByRole('region', { name: 'Appearance' });
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    const modes = screen.getByRole('radiogroup', { name: 'Light, dark or system' });
    expect(within(modes).getByRole('radio', { name: 'Dark' })).toBeChecked();
    fireEvent.click(within(modes).getByRole('radio', { name: 'System' }));
    expect(root().hasAttribute('data-mode')).toBe(false);
    expect(JSON.parse(stored(STORAGE_KEYS.mode)!)).toBe('system');
    fireEvent.click(within(modes).getByRole('radio', { name: 'Light' }));
    expect(root().getAttribute('data-mode')).toBe('light');
  });

  /** Appearance, open over the stage. */
  const appearance = async () => {
    await openApp('/DM?panel=appearance');
    await screen.findByRole('region', { name: 'Appearance' });
  };
  /** A copy of Workshop, open in the editor. */
  const workshopCopy = async () => {
    await appearance();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate and edit Workshop' }));
    await screen.findByRole('region', { name: 'Edit “Workshop copy”' });
  };

  it('LA-V62-R01-T02 The Appearance page lists every theme with a preview, the one in use marked', async () => {
    await appearance();
    const list = screen.getByRole('list', { name: 'Themes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(list.querySelectorAll('.theme-chip')).toHaveLength(5);
    // A preview draws with its theme's tokens, set inline as custom properties.
    expect((list.querySelectorAll<HTMLElement>('.theme-chip')[2]).style.getPropertyValue('--paper')).toBe('#F6F0E6');
    expect(screen.getByRole('button', { name: 'Use Lathe' })).toHaveAttribute('aria-pressed', 'true');
    // Pointing at a theme previews it live on the stage; leaving puts back the one in use.
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Use Graphite' }));
    expect(root().getAttribute('data-theme')).toBe('graphite');
    fireEvent.mouseLeave(list);
    expect(root().getAttribute('data-theme')).toBe('lathe');
    fireEvent.click(screen.getByRole('button', { name: 'Use Graphite' }));
    expect(root().getAttribute('data-theme')).toBe('graphite');
  });

  it('LA-PLT-INV03-T A built-in theme is changed only through a copy, and Reset puts the copy back to it, keeping its name', async () => {
    await workshopCopy();
    expect(root().getAttribute('data-theme')).toBe('custom-workshop-copy');
    fireEvent.input(screen.getByLabelText('Accent, light'), { target: { value: '#123456' } });
    expect(themeStyle()).toContain('--steel: #123456;');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Workshop' }));
    expect(themeStyle()).toContain('--steel: #9C3F17;');
    expect(screen.getByRole('region', { name: 'Edit “Workshop copy”' })).toBeInTheDocument();
    expect(BUILT_IN_THEMES[2].light['--steel']).toBe('#9C3F17');
  });

  it('LA-PLT-INV04-T Deleting the theme in use goes back to Lathe', async () => {
    await workshopCopy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm delete' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(window.location.search).toBe('?panel=appearance'));
    expect(root().getAttribute('data-theme')).toBe('lathe');
  });

  it('LA-V62-R02-T01 Duplicate and edit makes a copy in use, which is renamed, edited live, reset and deleted', async () => {
    await appearance();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate and edit Workshop' }));
    // The editor is a larger panel over the stage, at its own address.
    await screen.findByRole('region', { name: 'Edit “Workshop copy”' });
    expect(window.location.search).toBe('?panel=theme&theme=custom-workshop-copy');
    expect(root().getAttribute('data-theme')).toBe('custom-workshop-copy');
    // Colors by purpose, light and dark side by side.
    expect(within(screen.getByRole('region', { name: 'Edit “Workshop copy”' })).getAllByRole('group').map((g) => g.querySelector('legend')?.textContent).filter(Boolean)).toEqual(['Surfaces', 'Text', 'Borders', 'Accent', 'Signals', 'Graph', 'Depth']);
    expect(screen.getByRole('textbox', { name: 'Paper, light, value' })).toHaveValue('#F6F0E6');
    expect(screen.getByRole('textbox', { name: 'Paper, dark, value' })).toHaveValue('#1D1712');

    // A color change shows on the whole app at once.
    fireEvent.input(screen.getByLabelText('Accent, light'), { target: { value: '#123456' } });
    expect(themeStyle()).toContain('--steel: #123456;');
    // Type, shape, density and motion are tokens too.
    fireEvent.change(screen.getByRole('slider', { name: /^Text size/ }), { target: { value: '17' } });
    expect(themeStyle()).toContain('--text-size: 17px;');
    fireEvent.change(screen.getByRole('slider', { name: /^Panel corner radius/ }), { target: { value: '12' } });
    expect(themeStyle()).toContain('--panel-radius: 12px;');
    fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(themeStyle()).toContain('--density: 0.5;');
    fireEvent.click(screen.getByRole('radio', { name: 'Always reduced' }));
    expect(themeStyle()).toContain('--motion-speed: 0ms;');
    expect(themeStyle()).toContain('--hover-speed: 0ms;');
    fireEvent.change(screen.getByRole('combobox', { name: 'Text' }), { target: { value: 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' } });
    expect(themeStyle()).toContain('--body: system-ui, "Segoe UI", Roboto');

    // Rename.
    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Shop floor' } });
    fireEvent.blur(name);
    await screen.findByRole('region', { name: 'Edit “Shop floor”' });
    expect(stored(STORAGE_KEYS.themes)).toContain('"name":"Shop floor"');

    // Reset goes back to Workshop's values, keeping the name.
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Workshop' }));
    expect(themeStyle()).toContain('--steel: #9C3F17;');
    expect(themeStyle()).not.toContain('--text-size: 17px;');
    expect(screen.getByRole('region', { name: 'Edit “Shop floor”' })).toBeInTheDocument();

    // Delete asks first, then goes back to the list and to Lathe.
    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm delete' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(window.location.search).toBe('?panel=appearance'));
    expect(within(screen.getByRole('list', { name: 'Themes' })).getAllByRole('listitem')).toHaveLength(5);
    expect(root().getAttribute('data-theme')).toBe('lathe');
  });

  /** A copy of Lathe in the editor, with its light muted text set to a pale gray. */
  const paleMuted = async () => {
    await openApp('/DM?panel=appearance');
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate and edit Lathe' }));
    await screen.findByRole('region', { name: 'Edit “Lathe copy”' });
    const muted = screen.getByRole('textbox', { name: 'Muted text, light, value' });
    const row = muted.closest('[role="row"]') as HTMLElement;
    expect(row.querySelectorAll('.contrast-warning')).toHaveLength(0);
    fireEvent.change(muted, { target: { value: '#B0B0B0' } });
    fireEvent.keyDown(muted, { key: 'Enter' });
    await waitFor(() => expect(row.querySelectorAll('.contrast-warning')).toHaveLength(2));
    return { muted, row };
  };

  it('LA-PLT-DS02-T01 The contrast of a color on what it is drawn on is worked out against AA, per mode', async () => {
    const { row } = await paleMuted();
    expect(row.querySelectorAll('.contrast-warning')[0]).toHaveTextContent('1.99:1 on Paper; needs 4.5:1');
    // Only the light cell warns: the dark set is unchanged.
    expect(row.querySelectorAll('[role="cell"]')[1].querySelectorAll('.contrast-warning')).toHaveLength(0);
  });

  it('LA-V62-R03-T01 While editing, a color below WCAG AA gets a warning beside its swatch, and a value that is not a color is refused', async () => {
    const { muted, row } = await paleMuted();
    expect(row.querySelectorAll('.contrast-warning').length).toBeGreaterThan(0);
    // A value that is not a color is refused and marked, and nothing changes.
    fireEvent.change(muted, { target: { value: 'red; } body { display: none' } });
    fireEvent.keyDown(muted, { key: 'Enter' });
    expect(muted).toHaveAttribute('aria-invalid', 'true');
    expect(themeStyle()).not.toContain('display: none');
  });

  const file = toFile(BUILT_IN_THEMES[2]);
  const refused = (input: unknown) => { const r = parseTheme(input); return r.ok ? null : r.error; };

  it('LA-VO63-C01-T A theme file says its format and version and holds known fields only', () => {
    expect(Object.keys(file)).toEqual(['format', 'version', 'name', 'light', 'dark', 'tokens']);
    expect(file.format).toBe('lathe-theme');
    expect(file.version).toBe(1);
    expect(parseTheme(JSON.parse(JSON.stringify(file)))).toEqual({ ok: true, theme: file });
    expect(refused({ ...file, version: 2 })).toMatch(/version 2/);
    expect(refused({ ...file, format: 'other' })).toMatch(/not a theme file/);
    expect(refused({ ...file, selectors: {} })).toMatch(/Unknown field: selectors/);
  });

  it('LA-PLT-INV02-T A partial theme file takes Lathe\'s core colors for what it leaves out, in both modes', () => {
    const partial = parseTheme({ format: 'lathe-theme', version: 1, name: 'Only ink', light: { '--ink': '#000000' } });
    expect(partial.ok && partial.theme.light['--paper']).toBe('#F4F6F5');
    expect(partial.ok && partial.theme.dark['--paper']).toBe('#11171B');
  });

  it('LA-VO62-C01-T Token values name known tokens, each with a value of its kind, and carry nothing else', () => {
    expect(refused({ ...file, light: { ...file.light, '--node-radius': '2px' } })).toMatch(/not a color token/);
    expect(refused({ ...file, light: { '.card': '#fff' } })).toMatch(/not a color token/);
    expect(refused({ ...file, light: { '--paper': '#fff; } body { color: red' } })).toMatch(/not a value it takes/);
    expect(refused({ ...file, tokens: { '--text-size': '40px' } })).toMatch(/not a value it takes/);
    expect(refused({ ...file, tokens: { '--body': 'x}; @import url(evil)' } })).toMatch(/not a value it takes/);
  });

  it('LA-V62-R04-T01 A theme file imports as a new theme of one\'s own, kept in local storage; a bad one is refused, saying why', async () => {
    await appearance();
    const upload = screen.getByLabelText('Import a theme file');
    fireEvent.change(upload, { target: { files: [new File(['{"format":"lathe-theme","version":9}'], 'bad.json')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('version 9');
    fireEvent.change(upload, { target: { files: [new File([JSON.stringify({ ...file, name: 'Shared' })], 'shared.lathe-theme.json')] } });
    expect(await screen.findByText('Added “Shared”.')).toHaveAttribute('role', 'status');
    expect(within(screen.getByRole('list', { name: 'Themes' })).getAllByRole('listitem')).toHaveLength(6);
    expect(JSON.parse(stored(STORAGE_KEYS.themes)!)[0]).toMatchObject({ id: 'custom-shared', name: 'Shared', light: file.light });
  });

  it('LA-V61-R06-T02 The early script in index.html puts the chosen theme and mode on the page before the app runs', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    // It runs before the app's module script.
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<script type="module"'));
    const css = themeCss(BUILT_IN_THEMES[4]);
    window.localStorage.setItem(STORAGE_KEYS.css, css);
    window.localStorage.setItem(STORAGE_KEYS.chosen, JSON.stringify('graphite'));
    window.localStorage.setItem(STORAGE_KEYS.mode, JSON.stringify('dark'));
    document.getElementById('lathe-theme')?.remove();
    root().removeAttribute('data-theme');
    root().removeAttribute('data-mode');
    new Function(script!)();
    expect(document.getElementById('lathe-theme')?.textContent).toBe(css);
    expect(root().getAttribute('data-theme')).toBe('graphite');
    expect(root().getAttribute('data-mode')).toBe('dark');
    // With nothing stored it leaves the page to the stylesheet's own Lathe theme, following the system.
    window.localStorage.clear();
    document.getElementById('lathe-theme')?.remove();
    root().removeAttribute('data-theme');
    root().removeAttribute('data-mode');
    new Function(script!)();
    expect(document.getElementById('lathe-theme')).toBeNull();
    expect(root().hasAttribute('data-mode')).toBe(false);
  });

  it('LA-V61-R48-T02 The built-in themes: Lathe is the stylesheet unchanged, High contrast reaches AAA for text, and each passes AA for its text and controls in both modes', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const block = (re: RegExp) => Object.fromEntries([...(css.match(re)?.[1] ?? '').matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    const rootLight = block(/^:root \{([\s\S]*?)\n\}/m);
    const rootDark = block(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}/);
    const lathe = BUILT_IN_THEMES[0];
    for (const [token, value] of Object.entries({ ...lathe.light, ...lathe.tokens })) expect([token, rootLight[token]]).toEqual([token, value]);
    for (const [token, value] of Object.entries(lathe.dark)) expect([token, rootDark[token]]).toEqual([token, value]);

    const hc = BUILT_IN_THEMES.find((t) => t.id === 'high-contrast')!;
    for (const mode of ['light', 'dark'] as const) {
      for (const c of auditContrast(hc, mode).filter((x) => ['--ink', '--muted'].includes(x.token))) expect([mode, c.token, c.bg, c.ratio >= 7]).toEqual([mode, c.token, c.bg, true]);
    }
    // Every pair the editor checks passes in each built-in but Lathe, which keeps today's values (its gaps are listed in the report).
    for (const theme of BUILT_IN_THEMES.filter((t) => t.id !== 'lathe')) {
      for (const mode of ['light', 'dark'] as const) {
        const failing = auditContrast(theme, mode).filter((c) => !c.ok).map((c) => `${theme.id} ${mode} ${c.token} on ${c.bg}: ${c.ratio.toFixed(2)}`);
        expect(failing).toEqual([]);
      }
    }
  });
});
