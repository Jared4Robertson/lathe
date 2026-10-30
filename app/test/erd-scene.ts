import { fireEvent } from '@testing-library/react';
import type { ErdHost, ErdScene, ErdSceneBox } from '../src/erd/ErdView';

// Reading the ERD as its canvas draws it (erd/paint.ts): the canvas's scene through its test hook, and the boxes'
// keyboard layer, which carries focus, Enter, a click from assistive technology and each box's name and fields.

/** The ERD's canvas element (the first, or the one in a container). */
export const erdHost = (within: ParentNode = document) => within.querySelector<ErdHost>('.erd-flow');
/** What the canvas draws now; with `whole`, every box and line of the map. */
export const erdScene = (within: ParentNode = document, whole = false): ErdScene => erdHost(within)!.erdScene!(whole);
/** A box as the canvas draws it, in view or not. */
export const erdBox = (id: string, within: ParentNode = document): ErdSceneBox | undefined => erdScene(within, true).boxes.find((b) => b.id === id);
/** A box's element in the keyboard's layer. */
export const erdNode = (id: string, within: ParentNode = document) => within.querySelector<HTMLElement>(`.erd-node[data-id="${id}"]`);
/** Every box's place in the map, as one comparable record. */
export const erdPlaces = (within: ParentNode = document) => Object.fromEntries(erdScene(within, true).boxes.map((b) => [b.id, JSON.stringify(b.map)]));
/** Whether the canvas draws its map yet. */
export const erdDrawn = (within: ParentNode = document) => !!erdHost(within)?.erdScene && erdScene(within, true).boxes.length > 0;
/** The pointer over a point of the map, by a mouse. */
export function hoverMapPoint(p: { x: number; y: number }, within: ParentNode = document) {
  const { camera } = erdScene(within);
  const canvas = erdHost(within)!.querySelector('canvas')!;
  fireEvent.pointerMove(canvas, { clientX: p.x * camera.zoom + camera.x, clientY: p.y * camera.zoom + camera.y, pointerType: 'mouse', pointerId: 1 });
}
