import { PLAIN_MEASURE, type Face, type TextMeasure } from './text';

// The faces the graph's canvas draws its text in, and the measure the maps are laid out with
// (LA-EXP-DS06): the theme's body and mono stacks (`--body`, `--mono`), loaded before the first
// layout, measured by the canvas's own text metrics. A map is laid out once per spec load and
// faces, and the canvas draws its lines with the very faces they were measured in, so every line
// fits its box at any zoom. The Voronoi map is laid out in a worker (voronoi.worker.ts), which
// loads the same faces from the stylesheet's own @font-face sources and measures the same way.

/** Where a font is measured: at this size, then scaled, so a width is as exact as the face allows. */
const MEASURE_PX = 100;
/** How long the faces may take to load before the measure goes ahead with whatever has loaded. */
const LOAD_TIMEOUT_MS = 3000;

/** The two stacks the graph draws with, as the stylesheet sets them. */
export interface GraphFonts { body: string; mono: string }

/** The CSS font for a face at a size in px: the title in the body face at 600, a badge in mono at 700, the rest in mono. */
export function fontFor(fonts: GraphFonts, face: Face, px: number): string {
  if (face === 'title') return `600 ${px}px ${fonts.body}`;
  if (face === 'badge') return `700 ${px}px ${fonts.mono}`;
  return `400 ${px}px ${fonts.mono}`;
}

const FACES: readonly Face[] = ['title', 'meta', 'badge'];

/** The stylesheet's stacks, read from the page's root. */
export function readGraphFonts(): GraphFonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return { body: read('--body', 'sans-serif'), mono: read('--mono', 'monospace') };
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A measure over a canvas context, each width read once and kept (wrapping measures the same words and lines many times). */
export function canvasMeasure(ctx: Context2D, fonts: GraphFonts): TextMeasure {
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

/** Waits for a set of faces to load (or for the timeout: the measure then takes what is there). */
async function loadFaces(set: FontFaceSet, fonts: GraphFonts) {
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
    await loadFaces(document.fonts, fonts);
    return canvasMeasure(ctx, fonts);
  })();
  measures.set(key, promise);
  void promise.then((m) => ready.set(key, m));
  return promise;
}

/** One @font-face of the stylesheet, as a worker loads it: its family, its source with absolute addresses, and its descriptors. */
export interface FaceSource { family: string; source: string; weight: string; style: string; unicodeRange: string }
/** What the Voronoi worker needs to measure as the page does: the plain measure, or the stacks and the faces' sources. */
export type MeasureSpec = { kind: 'plain' } | { kind: 'canvas'; fonts: GraphFonts; faces: FaceSource[] };

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '');

/** The page's @font-face rules for the families in the stacks, their sources made absolute. */
function faceSources(fonts: GraphFonts): FaceSource[] {
  const families = new Set(`${fonts.body},${fonts.mono}`.split(',').map(unquote));
  const out: FaceSource[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    const base = sheet.href ?? document.baseURI;
    for (const rule of [...rules]) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = unquote(rule.style.getPropertyValue('font-family'));
      if (!families.has(family)) continue;
      const source = rule.style.getPropertyValue('src').replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_, _q, url: string) => `url("${new URL(url, base).href}")`);
      out.push({ family, source, weight: rule.style.getPropertyValue('font-weight') || 'normal', style: rule.style.getPropertyValue('font-style') || 'normal', unicodeRange: rule.style.getPropertyValue('unicode-range') || 'U+0-10FFFF' });
    }
  }
  return out;
}

/** What to send the worker for a measure: the plain one, or the page's stacks and faces. */
export function measureSpec(measure: TextMeasure, fonts: GraphFonts): MeasureSpec {
  return measure === PLAIN_MEASURE ? { kind: 'plain' } : { kind: 'canvas', fonts, faces: faceSources(fonts) };
}

/** In the worker: the measure a spec asks for, its faces loaded into the worker's own font set. */
export async function workerMeasure(spec: MeasureSpec): Promise<TextMeasure> {
  if (spec.kind === 'plain' || typeof OffscreenCanvas === 'undefined') return PLAIN_MEASURE;
  const set = (self as unknown as { fonts: FontFaceSet }).fonts;
  for (const f of spec.faces) {
    try { set.add(new FontFace(f.family, f.source, { weight: f.weight, style: f.style, unicodeRange: f.unicodeRange })); } catch { /* a face it cannot read: the next in the stack draws */ }
  }
  await loadFaces(set, spec.fonts);
  const ctx = new OffscreenCanvas(1, 1).getContext('2d');
  return ctx ? canvasMeasure(ctx, spec.fonts) : PLAIN_MEASURE;
}
