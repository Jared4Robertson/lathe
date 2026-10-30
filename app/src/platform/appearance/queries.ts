import { LATHE, toFile, type ModeChoice, type Theme } from '../../theme/theme';
import type { ThemesReader } from './reader';

/** List the themes (LA-PLT-QRY04): every theme, the built-ins first, with the chosen one and the mode. */
export function listThemes(reader: ThemesReader): { themes: readonly Theme[]; active: Theme; mode: ModeChoice } {
  return { themes: reader.themes(), active: reader.active(), mode: reader.mode() };
}

/** Get a theme file (LA-PLT-QRY05): a theme as a file to save or share (Lathe's when there is no such theme). */
export function getThemeFile(reader: ThemesReader, { id }: { id: string }): string {
  return `${JSON.stringify(toFile(reader.theme(id) ?? LATHE), null, 2)}\n`;
}
