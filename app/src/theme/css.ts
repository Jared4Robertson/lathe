import type { Mode, ThemeFile, TokenValues } from './theme';
import { tokenValue } from './theme';
import { COLOR_TOKENS, SETTING_TOKENS } from './tokens';

// Writes a theme as the stylesheet it sets: token values on `:root[data-theme]`, which outranks the
// stylesheet's own `:root` and so needs no selector of its own. The light set applies always; the
// dark set applies when the system is dark and the person has not chosen Light, or when they chose
// Dark (`data-mode` on <html>).

const declarations = (values: TokenValues, scheme?: Mode) => {
  const lines = Object.entries(values).map(([name, value]) => `${name}: ${value};`);
  if (scheme) lines.push(`color-scheme: ${scheme};`);
  return lines.join(' ');
};

export function themeCss(theme: ThemeFile): string {
  const light = { ...theme.light, ...theme.tokens };
  return [
    `:root[data-theme] { ${declarations(light, 'light')} }`,
    `@media (prefers-color-scheme: dark) { :root[data-theme]:not([data-mode="light"]) { ${declarations(theme.dark, 'dark')} } }`,
    `:root[data-theme][data-mode="dark"] { ${declarations(theme.dark, 'dark')} }`,
  ].join('\n');
}

/**
 * Every token of a theme in one mode, resolved as the stylesheet would, for a small preview drawn
 * with the theme's own colors in an inline style (custom properties only, so no color is literal).
 */
export function themeVars(theme: ThemeFile, mode: Mode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of COLOR_TOKENS) {
    const v = tokenValue(theme, mode, t.name);
    if (v) out[t.name] = v;
  }
  for (const t of SETTING_TOKENS) {
    const v = tokenValue(theme, mode, t);
    if (v) out[t] = v;
  }
  return out;
}
