/// <reference lib="webworker" />
import { canvasMeasure, faceLoads, type FaceSource, type GraphFonts } from './fonts';
import { fitCache, placeTree } from './map';
import { placeNested } from './nested';
import { placeGround } from './ground';
import { setTextMeasure, textMeasure } from './text';
import { probeOf, unpackInput, type LayoutReply, type LayoutRequest } from './layout-input';

// The layout's worker (layout.ts): lays a map out off the page's main thread, so the camera never waits on a layout.
// It measures text with the page's own faces, loaded here from the page's @font-face rules, so it fits every label
// exactly as the page draws it; the page checks that against its own measure before it uses the worker. It keeps its
// fits from one layout to the next (map.ts FitCache), so a new layout of a changed map fits again only what changed.

declare const self: DedicatedWorkerGlobalScope;

const fits = fitCache();

async function measureWith(fonts: GraphFonts, faces: readonly FaceSource[]) {
  for (const f of faces) {
    try { self.fonts.add(new FontFace(f.family, f.source, f.descriptors)); } catch { /* a face this worker cannot read is left to the stack's next */ }
  }
  await faceLoads(self.fonts, fonts);
  const ctx = new OffscreenCanvas(1, 1).getContext('2d');
  if (!ctx) throw new Error('no 2D context in the layout worker');
  setTextMeasure(canvasMeasure(ctx, fonts));
}

self.onmessage = async (e: MessageEvent<LayoutRequest>) => {
  const message = e.data;
  if (message.type === 'fonts') {
    await measureWith(message.fonts, message.faces);
    self.postMessage({ type: 'ready', measure: textMeasure().key, probe: probeOf(textMeasure()) } satisfies LayoutReply);
    return;
  }
  const start = performance.now();
  const { shape, labels, roles } = unpackInput(message.packed, message.roots);
  const geometry = message.view === 'tree' ? placeTree(shape, (i) => labels[i], fits) : message.view === 'map' ? placeGround(shape, (i) => labels[i], (i) => roles[i], message.kept) : placeNested(shape, (i) => labels[i]);
  self.postMessage({ type: 'laid', id: message.id, boxes: geometry.boxes, width: geometry.width, height: geometry.height, ms: performance.now() - start } satisfies LayoutReply, [geometry.boxes.buffer]);
};
