import { workerMeasure, type MeasureSpec } from './fonts';
import { setTextMeasure } from './text';
import { layoutTreeOf, type VoronoiTree } from './voronoi';

// The worker the Voronoi map is laid out in (LA-EXP-DR64): its power diagrams take a few hundred
// milliseconds for a large product, so the page never waits on them. It takes a product's tree,
// as voronoi.ts's `voronoiTree` reads it, and the faces the page measures its text with (fonts.ts),
// loads those faces into its own font set, and sends back the map.

/** The measure each spec asked for, made once. */
const measures = new Map<string, ReturnType<typeof workerMeasure>>();

self.onmessage = async (e: MessageEvent<{ id: number; tree: VoronoiTree; measure: MeasureSpec }>) => {
  const key = JSON.stringify(e.data.measure);
  if (!measures.has(key)) measures.set(key, workerMeasure(e.data.measure));
  setTextMeasure(await measures.get(key)!);
  self.postMessage({ id: e.data.id, map: layoutTreeOf(e.data.tree) });
};
