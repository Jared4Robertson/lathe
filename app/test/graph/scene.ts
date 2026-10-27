import { fireEvent } from '@testing-library/react';
import type { Scene, SceneBox, SceneHost } from '../../src/graph/GraphPage';

// Reading the graph as the canvas draws it (LA-EXP-C05): the canvas's scene, through its test hook,
// and the boxes' accessibility layer, which carries focus, the keyboard and each box's name.

/** The graph's canvas element (the first, or the one in a container). */
export const graphHost = (within: ParentNode = document) => within.querySelector<SceneHost>('.graph-flow');
/** What the canvas draws now. */
export const scene = (within: ParentNode = document): Scene => graphHost(within)!.graphScene!();
/** A drawn box, or undefined when it is not drawn. */
export const drawnBox = (id: string, within: ParentNode = document): SceneBox | undefined => {
  const host = graphHost(within);
  return host?.graphScene ? host.graphScene().boxes.find((b) => b.id === id) : undefined;
};
/** The ids of the drawn boxes. */
export const drawnIds = (within: ParentNode = document): string[] => {
  const host = graphHost(within);
  return host?.graphScene ? host.graphScene().boxes.map((b) => b.id) : [];
};
/** A box's element in the accessibility layer: what takes focus, the keyboard and a click from assistive technology. */
export const boxElement = (id: string, within: ParentNode = document) => within.querySelector<HTMLElement>(`.graph-box[data-id="${id}"]`);
/** The boxes in the accessibility layer. */
export const boxElements = (within: ParentNode = document) => [...within.querySelectorAll<HTMLElement>('.graph-box')];
/** Whether a box is drawn as the focus. */
export const isCenter = (id: string) => !!drawnBox(id)?.focus;
/** The camera, as one comparable string. */
export const cameraOf = (within: ParentNode = document) => JSON.stringify(scene(within).camera);

/** The canvas the map is drawn on. */
export const canvasOf = (within: ParentNode = document) => graphHost(within)!.querySelector('canvas')!;
/** A point on a drawn box, in the page's pixels: the middle of its label, which no child is drawn over. */
export const pointOn = (id: string, within: ParentNode = document) => {
  const b = drawnBox(id, within)!;
  return { x: b.label.left + b.label.width / 2, y: b.label.top + b.label.height / 2 };
};
/** The mouse over a drawn box (or off every box, for null). */
export function hoverBox(id: string | null, within: ParentNode = document) {
  const at = id ? pointOn(id, within) : { x: -1e6, y: -1e6 };
  fireEvent.pointerMove(canvasOf(within), { clientX: at.x, clientY: at.y, pointerType: 'mouse', pointerId: 1 });
}
/** The mouse leaves the canvas. */
export const leaveCanvas = (within: ParentNode = document) => fireEvent.pointerLeave(canvasOf(within), { pointerType: 'mouse', pointerId: 1 });
/** A press and release at a point of the canvas, by a finger or the mouse. */
export function tapAt(at: { x: number; y: number }, pointerType: 'touch' | 'mouse' = 'touch', within: ParentNode = document) {
  const c = canvasOf(within);
  fireEvent.pointerDown(c, { clientX: at.x, clientY: at.y, pointerType, pointerId: 7, button: 0 });
  fireEvent.pointerUp(c, { clientX: at.x, clientY: at.y, pointerType, pointerId: 7, button: 0 });
}
/** A tap on the canvas away from every box. */
export const tapEmpty = (within: ParentNode = document) => tapAt({ x: -1e6, y: -1e6 }, 'touch', within);
