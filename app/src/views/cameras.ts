// Each place's camera (place.ts), kept while the window is open: a stage keeps its camera under the place's key as it
// is left (another tab activated, another stage shown) and takes it back when that place shows again, so a tab comes
// back as it was. A camera is kept with what it framed (the focus, the layout and the depth), and is taken back only
// while they are the same: a place that moved on is framed anew. Not kept through a reload, which frames the focus.

export interface KeptCamera<V> {
  /** What the camera framed: a stage's focus, layout and depth, joined. */
  framed: string;
  view: V;
}

const kept = new Map<string, KeptCamera<unknown>>();

/** Keeps a stage's camera for a place. */
export function keepCamera<V>(place: string, stage: string, camera: KeptCamera<V>) {
  kept.set(`${place} ${stage}`, camera);
}

/** A place's camera on a stage, if one was kept for what the stage frames now. */
export function keptCamera<V>(place: string, stage: string, framed: string): V | null {
  const camera = kept.get(`${place} ${stage}`);
  return camera && camera.framed === framed ? (camera.view as V) : null;
}

/** Forgets a closed place's cameras. */
export function forgetCameras(place: string) {
  for (const key of kept.keys()) if (key.startsWith(`${place} `)) kept.delete(key);
}

/** Gives a duplicated place the cameras of the place it copies. */
export function copyCameras(from: string, to: string) {
  for (const [key, camera] of [...kept]) if (key.startsWith(`${from} `)) kept.set(`${to} ${key.slice(from.length + 1)}`, camera);
}
