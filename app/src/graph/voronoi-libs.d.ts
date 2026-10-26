// Types for the two libraries the Voronoi map (voronoi.ts) uses, which ship none: only what it calls.

declare module 'd3-voronoi-map' {
  /** A cell of the power diagram: its corners, with the site it belongs to. */
  export interface VoronoiMapPolygon<D> extends Array<[number, number]> {
    site: { x: number; y: number; weight: number; originalObject: { data: { originalData: D } } };
  }
  export interface VoronoiMapSimulation<D> {
    weight(accessor: (d: D) => number): VoronoiMapSimulation<D>;
    clip(polygon: [number, number][]): VoronoiMapSimulation<D>;
    convergenceRatio(ratio: number): VoronoiMapSimulation<D>;
    maxIterationCount(count: number): VoronoiMapSimulation<D>;
    minWeightRatio(ratio: number): VoronoiMapSimulation<D>;
    prng(random: () => number): VoronoiMapSimulation<D>;
    initialPosition(at: (d: D) => [number, number]): VoronoiMapSimulation<D>;
    stop(): VoronoiMapSimulation<D>;
    tick(): void;
    state(): { ended: boolean; iterationCount: number; convergenceRatio: number; polygons: VoronoiMapPolygon<D>[] };
  }
  export function voronoiMapSimulation<D>(data: D[]): VoronoiMapSimulation<D>;
}

declare module 'polylabel' {
  /** The pole of inaccessibility of a polygon (its rings), within a precision: the point farthest from its edges, with that distance. */
  export default function polylabel(rings: [number, number][][], precision?: number): [number, number] & { distance: number };
}
