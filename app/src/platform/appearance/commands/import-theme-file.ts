// Import a theme file (LA-PLT-CMD06): the person adds a theme file as a theme of their own, or is told what is wrong with it.
import { freshName, newThemeId, parseTheme, type Theme } from '../../../theme/theme';
import { allThemes } from '../model';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ImportThemeFile { text: string }
export type ImportResult = { ok: true; theme: Theme } | { ok: false; error: string };

/** Reads the file and adds it under a name no other theme has; a file that is not a theme is refused with its reason. */
export function importThemeFile({ text }: ImportThemeFile): ImportResult {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: 'The file is not JSON.' }; }
  const parsed = parseTheme(json);
  if (!parsed.ok) return parsed;
  const was = appearanceRepository.load();
  const themes = allThemes(was);
  const name = themes.some((t) => t.name === parsed.theme.name) ? freshName(parsed.theme.name, themes.map((t) => t.name)) : parsed.theme.name;
  const theme: Theme = { ...parsed.theme, name, id: newThemeId(name, themes.map((t) => t.id)), builtIn: false };
  const next = { ...was, custom: [...was.custom, theme] };
  holdToRules(next);
  appearanceRepository.save(next);
  return { ok: true, theme };
}
