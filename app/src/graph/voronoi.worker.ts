import { layoutTreeOf, type VoronoiTree } from './voronoi';

// The worker the Voronoi map is laid out in (LA-EXP-DR64): its power diagrams take a few hundred
// milliseconds for a large product, so the page never waits on them. It takes a product's tree,
// as voronoi.ts's `voronoiTree` reads it, and sends back the map.

self.onmessage = (e: MessageEvent<{ id: number; tree: VoronoiTree }>) => {
  self.postMessage({ id: e.data.id, map: layoutTreeOf(e.data.tree) });
};
