// LA-PAT-APP-CODE-R21: nothing outlives its purpose. Every command in the keymap is handled and can
// be reached (by its shortcut, a button or menu that names it, or the command palette, which lists
// every handled command that is not local to a component), every command a button names is in the
// keymap, and every icon in icons.tsx is drawn somewhere. Checked at the source, so a removed
// feature's command or icon fails here instead of lingering.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMANDS, SPACE_KEYS, spaceCommandId } from '../src/shell/keymap';
import { SIDE_VIEW_ICONS } from '../src/views/sideBarState';
import { VIEW_NAMES } from '../src/views/address';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const code = (files: string[]) =>
  files.map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')).join('\n');
const ICONS_FILE = path.join(src, 'components/icons.tsx');
const files = walk(src).filter((f) => /\.(ts|tsx)$/.test(f));
const source = code(files);
const outsideIcons = code(files.filter((f) => f !== ICONS_FILE));
const quoted = (text: string) => [...text.matchAll(/'([A-Za-z0-9_-]+)'|"([A-Za-z0-9_-]+)"/g)].map((m) => m[1] ?? m[2]);

/** Command IDs registered with useCommand('id', ...); the space commands are registered through spaceCommandId(n). */
const handled = new Set([...source.matchAll(/useCommand\(\s*'([A-Za-z0-9]+)'/g)].map((m) => m[1]));
if (/useCommand\(\s*spaceCommandId\(/.test(source)) for (let n = 1; n <= SPACE_KEYS; n++) handled.add(spaceCommandId(n));

describe('LA-STD-PRINCIPLES-R04-T03 commands', () => {
  it('Every command in the keymap is handled and can be reached', () => {
    const unhandled = COMMANDS.filter((c) => !c.local && !c.browser && !handled.has(c.id)).map((c) => c.id);
    expect(unhandled, 'commands no component registers with useCommand').toEqual([]);
    // A local or browser command is never in the palette, so its keys are the only way to it.
    const unreachable = COMMANDS.filter((c) => (c.local || c.browser) && c.keys.length === 0).map((c) => c.id);
    expect(unreachable, 'local or browser commands with no keys').toEqual([]);
  });

  it('Every command a button, a tooltip or a run names is in the keymap', () => {
    const ids = new Set(COMMANDS.map((c) => c.id));
    const named = [
      ...[...source.matchAll(/command=(?:"([^"]+)"|\{([^}]+)\})/g)].flatMap((m) => (m[1] ? [m[1]] : quoted(m[2]))),
      ...[...source.matchAll(/(?:useShortcutHint|\brun)\(\s*'([^']+)'/g)].map((m) => m[1]),
      ...[...source.matchAll(/useCommand\(\s*'([^']+)'/g)].map((m) => m[1]),
    ];
    expect([...new Set(named.filter((id) => !ids.has(id)))]).toEqual([]);
  });
});

describe('LA-STD-PRINCIPLES-R04-T03 icons', () => {
  it('Every icon in icons.tsx is drawn somewhere', () => {
    const table = readFileSync(ICONS_FILE, 'utf8').match(/const PATHS[^{]*\{([\s\S]*?)\n\};/)![1];
    const icons = [...table.matchAll(/^\s+'?([a-z][a-z-]*)'?:/gm)].map((m) => m[1]);
    expect(icons.length).toBeGreaterThan(10);
    // Where an icon is named: an Icon's or a control's name or icon attribute, an icon map, and the
    // page bar, which draws each view's icon by the view's name.
    const drawn = new Set([
      ...[...outsideIcons.matchAll(/\b(?:name|icon)=(?:"([^"]+)"|\{([^}]+)\})/g)].flatMap((m) => (m[1] ? [m[1]] : quoted(m[2]))),
      ...[...outsideIcons.matchAll(/\bicon:\s*'([^']+)'/g)].map((m) => m[1]),
      ...Object.values(SIDE_VIEW_ICONS),
      ...VIEW_NAMES,
    ]);
    expect(icons.filter((name) => !drawn.has(name))).toEqual([]);
  });
});
