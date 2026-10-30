// Keep a place's camera (LA-EXP-CMD28): a stage keeps its camera, with what it framed, under the place's key as the place is left, so the place comes back as it was.
import type { KeptCamera, TabSets } from '../model';

export interface KeepCamera {
  /** The place's key: its space and tab in the desktop app, `place` on the web. */
  place: string;
  stage: string;
  camera: KeptCamera<unknown>;
}

/** Keeps a stage's camera for a place. */
export function keepCamera(tabs: TabSets, input: KeepCamera): TabSets {
  return { ...tabs, cameras: new Map(tabs.cameras).set(`${input.place} ${input.stage}`, input.camera) };
}
