import { NODE_TEXT, PLAIN_MEASURE, type Face, type TextMeasure } from './text';

// The faces the graph's canvas draws its text in, and the measure the maps are laid out with
// (LA-EXP-DS06): the theme's body and mono stacks (`--body`, `--mono`), loaded before the first
// layout, measured by the canvas's own text metrics. A map is laid out again only when what it
// reads or its faces change (layout.ts), and the canvas draws its lines with the very faces they were measured in, so every line
// fits its box at any zoom.

/** Where a font is measured: at this size, then scaled, so a width is as exact as the face allows. */
const MEASURE_PX = 100;
/** How long the faces may take to load before the measure goes ahead with whatever has loaded. */
const LOAD_TIMEOUT_MS = 3000;

/** The two stacks the graph draws with, as the stylesheet sets them. */
export interface GraphFonts { body: string; mono: string }

/**
 * The CSS font for a face at a size in px: a title and an eyebrow's words in the body face at their weights in the node
 * text scale (text.ts NODE_TEXT), a badge in mono at 700, a record ID or code word in mono at 400.
 */
export function fontFor(fonts: GraphFonts, face: Face, px: number): string {
  if (face === 'title') return `${NODE_TEXT.title.weight} ${px}px ${fonts.body}`;
  if (face === 'eyebrow') return `${NODE_TEXT.eyebrow.weight} ${px}px ${fonts.body}`;
  if (face === 'badge') return `700 ${px}px ${fonts.mono}`;
  return `400 ${px}px ${fonts.mono}`;
}

const FACES: readonly Face[] = ['title', 'eyebrow', 'mono', 'badge'];

/** The stylesheet's stacks, read from the page's root. */
export function readGraphFonts(): GraphFonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return { body: read('--body', 'sans-serif'), mono: read('--mono', 'monospace') };
}

/** What a measure reads text with: a canvas's 2D context, the page's or the layout worker's offscreen one. */
type Measurer = { font: string; measureText: (text: string) => TextMetrics };

/** A measure over a canvas context, each width read once and kept (wrapping measures the same words and lines many times). */
export function canvasMeasure(ctx: Measurer, fonts: GraphFonts): TextMeasure {
  const widths = new Map<Face, Map<string, number>>(FACES.map((f) => [f, new Map()]));
  const metrics = new Map<Face, { ascent: number; descent: number }>();
  return {
    key: `canvas|${fonts.body}|${fonts.mono}`,
    em: (text, face) => {
      const known = widths.get(face)!;
      let w = known.get(text);
      if (w === undefined) {
        ctx.font = fontFor(fonts, face, MEASURE_PX);
        w = ctx.measureText(text).width / MEASURE_PX;
        known.set(text, w);
      }
      return w;
    },
    metrics: (face) => {
      let m = metrics.get(face);
      if (!m) {
        ctx.font = fontFor(fonts, face, MEASURE_PX);
        const t = ctx.measureText('Hg');
        m = { ascent: (t.fontBoundingBoxAscent ?? 0.95 * MEASURE_PX) / MEASURE_PX, descent: (t.fontBoundingBoxDescent ?? 0.25 * MEASURE_PX) / MEASURE_PX };
        metrics.set(face, m);
      }
      return m;
    },
  };
}

/** Waits for a set of faces to load (or for the timeout: the measure then takes what is there): the page's, or the layout worker's. */
export async function faceLoads(set: FontFaceSet, fonts: GraphFonts) {
  const loads = FACES.map((f) => set.load(fontFor(fonts, f, 16)).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS))]);
}

const measures = new Map<string, Promise<TextMeasure>>();
const ready = new Map<string, TextMeasure>();

/** The measure for the page's faces if it is ready, so a graph drawn again needs no wait. */
export const readyMeasure = (fonts: GraphFonts): TextMeasure | null => ready.get(`${fonts.body}|${fonts.mono}`) ?? null;

/**
 * The measure for the page's faces, once they have loaded (`document.fonts.ready`, and each face
 * asked for). Where the page has no canvas (the unit tests, in jsdom) it is the plain measure.
 */
export function pageMeasure(fonts: GraphFonts): Promise<TextMeasure> {
  const key = `${fonts.body}|${fonts.mono}`;
  const known = measures.get(key);
  if (known) return known;
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx || typeof document.fonts === 'undefined') {
    ready.set(key, PLAIN_MEASURE);
    const plain = Promise.resolve(PLAIN_MEASURE);
    measures.set(key, plain);
    return plain;
  }
  const promise = (async () => {
    await document.fonts.ready;
    await faceLoads(document.fonts, fonts);
    return canvasMeasure(ctx, fonts);
  })();
  measures.set(key, promise);
  void promise.then((m) => ready.set(key, m));
  return promise;
}

/** One of the page's @font-face rules, as the layout's worker loads it: its family, its source with absolute URLs, and its descriptors. */
export interface FaceSource { family: string; source: string; descriptors: FontFaceDescriptors }

/** The page's @font-face rules (fonts.css), so the layout's worker measures text in the very faces the page draws it in. */
export function pageFaces(): FaceSource[] {
  const out: FaceSource[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of [...rules]) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const read = (name: string) => rule.style.getPropertyValue(name).trim();
      const base = sheet.href ?? document.baseURI;
      const source = read('src').replace(/url\((["']?)([^"')]+)\1\)/g, (_, q: string, url: string) => `url(${q}${new URL(url, base).href}${q})`);
      const descriptors: FontFaceDescriptors = { style: read('font-style') || 'normal', weight: read('font-weight') || 'normal' };
      const range = read('unicode-range');
      if (range) descriptors.unicodeRange = range;
      out.push({ family: read('font-family').replace(/^["']|["']$/g, ''), source, descriptors });
    }
  }
  return out;
}
