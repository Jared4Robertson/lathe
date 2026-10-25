import { contrast, parseColor, type RGBA } from './contrast';
import { resolvedValue, type Mode, type ThemeFile } from './theme';
import { COLOR_TOKENS } from './tokens';

// The contrast of each text and control token on what it is drawn on, for a theme in a mode: what
// the editor warns about beside each swatch, and what the standards test checks for every built-in.

export interface ContrastCheck {
  token: string;
  bg: string;
  ratio: number;
  /** 4.5 for text, 3 for large text and controls. */
  min: number;
  ok: boolean;
}

/** A token's color as it shows in a mode: translucent colors laid over the sheet. */
export function colorOf(theme: ThemeFile, mode: Mode, token: string): RGBA | null {
  const value = resolvedValue(theme, mode, token);
  return value ? parseColor(value) : null;
}

/** Every contrast pair the token table names, measured in this mode. Pairs with a color that cannot be measured are left out. */
export function auditContrast(theme: ThemeFile, mode: Mode): ContrastCheck[] {
  const out: ContrastCheck[] = [];
  for (const t of COLOR_TOKENS) {
    if (!t.on) continue;
    const fg = colorOf(theme, mode, t.name);
    for (const bgName of t.on.bg) {
      const bg = colorOf(theme, mode, bgName);
      if (!fg || !bg) continue;
      const ratio = contrast(fg, bg);
      out.push({ token: t.name, bg: bgName, ratio, min: t.on.min, ok: ratio >= t.on.min });
    }
  }
  return out;
}

/** The pairs every built-in theme must pass (LA-PAT-APP-CODE-R15): body text, muted text and the accent on the page and on a sheet. */
export const REQUIRED_PAIRS: readonly [string, string][] = [
  ['--ink', '--paper'], ['--ink', '--sheet'],
  ['--muted', '--paper'], ['--muted', '--sheet'],
  ['--steel', '--paper'], ['--steel', '--sheet'],
];
