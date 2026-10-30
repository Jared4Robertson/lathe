import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrast, parseColor, type RGBA } from '../src/theme/contrast';

// Highlight changes' pills (LA-V96-R29, LA-EXP-UC15-R03): New, Changed and Removed are text on a fill in the change's color
// (--change-new, --change-changed, --change-gone: styles.css), and the nav's counts are that color as text on the sheet. In
// every look and both modes, each pair must read at AA for text (4.5:1).

const THEMES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/theme/themes');
const mix = (a: RGBA, pct: number, b: RGBA): RGBA => [0, 1, 2].map((i) => a[i] * pct + b[i] * (1 - pct)).concat(1) as RGBA;
const base = JSON.parse(readFileSync(path.join(THEMES, 'lathe.json'), 'utf8')) as { light: Record<string, string>; dark: Record<string, string> };
const RED: RGBA = [0xC0, 0x15, 0x2B, 1];

for (const file of readdirSync(THEMES).filter((f) => f.endsWith('.json'))) {
  const theme = JSON.parse(readFileSync(path.join(THEMES, file), 'utf8')) as { name: string; light: Record<string, string>; dark: Record<string, string> };
  for (const mode of ['light', 'dark'] as const) {
    describe(`${theme.name}, ${mode}`, () => {
      const t = theme[mode];
      /** A token's color: the theme's, else Lathe's own for the mode (what a token a theme leaves out takes), following a `var(--other)` to the token it names. */
      const lookup = (token: string) => t[token] ?? base[mode][token] ?? '';
      const color = (token: string): RGBA => {
        let value = lookup(token);
        for (let hops = 0; hops < 5; hops++) {
          const ref = value.match(/^var\((--[\w-]+)\)$/)?.[1];
          if (!ref) break;
          value = lookup(ref);
        }
        return parseColor(value)!;
      };
      // The tokens as styles.css derives them: new = the use cases stage's color, changed = the warning color, removed = the error color mixed toward red.
      const fills = { New: color('--g-use-cases'), Changed: color('--warn'), Removed: mix(color('--error'), 0.7, RED) };
      for (const [name, fill] of Object.entries(fills)) {
        it(`LA-V96-R29-T03 the ${name} pill's text reads on its fill, and its color reads as text on the sheet`, () => {
          expect(contrast(color('--on-mark'), fill)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(fill, color('--sheet'))).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }
}
