import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { BUILT_IN_THEMES, LATHE, toFile } from '../../src/theme/theme';
import { themeCss } from '../../src/theme/css';
import { APPEARANCE_KEYS, appearanceRepository } from '../../src/platform/appearance/repository';
import { holdToRules } from '../../src/platform/appearance/rules';
import { themesReader } from '../../src/platform/appearance/reader';
import { getThemeFile, listThemes } from '../../src/platform/appearance/queries';
import { chooseTheme } from '../../src/platform/appearance/commands/choose-theme';
import { chooseColorMode } from '../../src/platform/appearance/commands/choose-color-mode';
import { duplicateTheme } from '../../src/platform/appearance/commands/duplicate-theme';
import { importThemeFile } from '../../src/platform/appearance/commands/import-theme-file';
import { editTheme } from '../../src/platform/appearance/commands/edit-theme';
import { resetTheme } from '../../src/platform/appearance/commands/reset-theme';
import { deleteTheme } from '../../src/platform/appearance/commands/delete-theme';

// The Appearance aggregate's commands (LA-PLT-CMD03–09), each saved through AppearanceRepository, and the Themes reads.

const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null');

describe('the Appearance commands keep each change whole through its repository', () => {
  it('chooses a theme and a mode, writing the chosen theme\'s stylesheet for the early script', () => {
    chooseTheme({ id: 'midnight' });
    chooseColorMode({ mode: 'dark' });
    expect(stored(APPEARANCE_KEYS.chosen)).toBe('midnight');
    expect(stored(APPEARANCE_KEYS.mode)).toBe('dark');
    expect(window.localStorage.getItem(APPEARANCE_KEYS.css)).toBe(themeCss(BUILT_IN_THEMES[3]));
  });

  it('duplicates, edits, resets and deletes a theme of the person\'s own, and imports a file', () => {
    const id = duplicateTheme({ id: 'workshop' });
    expect(appearanceRepository.load().chosen).toBe(id);
    editTheme({ id, change: (file) => ({ ...file, name: 'Mine', light: { ...file.light, background: '#ffffff' } }) });
    expect(stored(APPEARANCE_KEYS.themes)[0]).toMatchObject({ id, name: 'Mine', basedOn: 'workshop' });
    resetTheme({ id });
    const reset = appearanceRepository.load().custom[0];
    expect(reset.name).toBe('Mine');
    expect(reset.light).toEqual(BUILT_IN_THEMES[2].light);
    deleteTheme({ id });
    expect(appearanceRepository.load()).toMatchObject({ custom: [], chosen: 'lathe' });
    expect(importThemeFile({ text: 'nope' })).toEqual({ ok: false, error: 'The file is not JSON.' });
    const imported = importThemeFile({ text: JSON.stringify({ ...toFile(LATHE), name: 'Shared' }) });
    expect(imported.ok && imported.theme.name).toBe('Shared');
  });

  it('lists the themes and hands out a theme file through the Themes reader', () => {
    chooseTheme({ id: 'graphite' });
    const reader = themesReader(appearanceRepository.load());
    const { themes, active } = listThemes(reader);
    expect(themes.map((t) => t.id)).toEqual(BUILT_IN_THEMES.map((t) => t.id));
    expect(active.id).toBe('graphite');
    expect(JSON.parse(getThemeFile(reader, { id: 'lathe' }))).toEqual(toFile(LATHE));
  });
});

describe('LA-PLT-INV31-T The Appearance refuses a theme without its sets, a built-in kept as the person\'s own, and a chosen theme that does not exist', () => {
  it('refuses each with its reason, and nothing is saved', () => {
    const before = window.localStorage.getItem(APPEARANCE_KEYS.chosen);
    expect(() => chooseTheme({ id: 'gone' })).toThrow(RuleBroken);
    expect(() => chooseTheme({ id: 'gone' })).toThrow('The chosen theme gone does not exist.');
    expect(() => holdToRules({ custom: [{ ...LATHE }], chosen: 'lathe', mode: 'system' })).toThrow('Theme "Lathe" is a built-in, which is never changed.');
    const noDark = { ...LATHE, id: 'custom-x', builtIn: false, dark: undefined } as unknown as typeof LATHE;
    expect(() => holdToRules({ custom: [noDark], chosen: 'lathe', mode: 'system' })).toThrow('Theme "Lathe" lacks its light or dark set.');
    expect(window.localStorage.getItem(APPEARANCE_KEYS.chosen)).toBe(before);
  });
});
