import { tabSetRepository } from './repository';

// What the stages read of the Tab set aggregate while they draw, outside React's render.

/** A place's camera on a stage, if one was kept for what the stage frames now: a place that moved on is framed anew. */
export function keptCamera<V>(place: string, stage: string, framed: string): V | null {
  const camera = tabSetRepository.load().cameras.get(`${place} ${stage}`);
  return camera && camera.framed === framed ? (camera.view as V) : null;
}

