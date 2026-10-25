// WCAG contrast between two colors (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio): AA asks
// 4.5:1 for text and 3:1 for large text and controls; AAA asks 7:1 for text.

export type RGBA = [number, number, number, number];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() in either syntax, and `transparent`. Null for anything else. */
export function parseColor(value: string): RGBA | null {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return [0, 0, 0, 0];
  const hex = v.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
  }
  const fn = v.match(/^rgba?\(([^)]*)\)$/)?.[1];
  if (fn) {
    const [rgb, alpha] = fn.includes('/') ? fn.split('/') : [fn, undefined];
    const parts = rgb.split(/[\s,]+/).filter(Boolean);
    const extra = alpha ?? (parts.length === 4 ? parts.pop() : undefined);
    if (parts.length !== 3) return null;
    const channel = (p: string) => (p.endsWith('%') ? (Number(p.slice(0, -1)) / 100) * 255 : Number(p));
    const a = extra === undefined ? 1 : extra.trim().endsWith('%') ? Number(extra.trim().slice(0, -1)) / 100 : Number(extra);
    const out: RGBA = [channel(parts[0]), channel(parts[1]), channel(parts[2]), a];
    return out.every(Number.isFinite) ? [clamp(out[0], 0, 255), clamp(out[1], 0, 255), clamp(out[2], 0, 255), clamp(out[3], 0, 1)] : null;
  }
  return null;
}

/** The color laid over a background, as it shows. */
export function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The contrast ratio, 1 to 21, of a foreground on a background (a translucent foreground is laid over it first). */
export function contrast(fg: RGBA, bg: RGBA): number {
  const back = bg[3] < 1 ? over(bg, [255, 255, 255, 1]) : bg;
  const front = fg[3] < 1 ? over(fg, back) : fg;
  const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** As #rrggbb, for a color input. */
export function toHex([r, g, b]: RGBA): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** A ratio as people read it: "4.52:1". */
export const formatRatio = (ratio: number) => `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
