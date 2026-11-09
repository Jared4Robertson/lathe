import { useEffect, useState } from 'react';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import { forgetWithReads } from '../record/read';
import { keep, mirrorOf } from '../exploring/record-summaries/space-index';
import { askSpace, spaceInWorker } from '../exploring/record-summaries/space-client';
import { keepInput, knownInput, patchInput, productInput, type InputChange, type MapInput } from './layout-input';

// A product's map's input for the Graph (layout-input.ts productInput), made by the space's index worker
// (exploring/record-summaries/space-index.ts) and put in by its change, so the page never walks a large product's tree to
// make it.

/** The inputs the page holds, by product, map and the builder's state they were made for. */
const held = new Map<string, Map<string, MapInput>>();
forgetWithReads(() => held.clear());
/** Puts an input's change in, keeping it as `index`'s input for that map. */
export function putInput(index: RecordIndex, root: string, view: MapInput['view'], measure: string, change: InputChange): MapInput | null {
  let inputs = held.get(index.product);
  if (!inputs) { inputs = new Map(); keep(held, index.product, inputs); }
  const key = `${view}|${measure}|${root}`;
  const before = inputs.get(key) ?? null;
  // A change from an input the page no longer holds cannot be put in: the next request asks for the whole input.
  if (change.kind !== 'whole' && !before) return null;
  const input = patchInput(before, change);
  inputs.set(key, input);
  keepInput(index, root, view, measure, input);
  return input;
}
/** Whether the page holds the input last sent for a map, which a change of it is from. */
export const holdsInput = (product: string, root: string, view: MapInput['view'], measure: string) => held.get(product)?.has(`${view}|${measure}|${root}`) ?? false;

/**
 * Asks the builder for a map's input for an index made from its mirror; null when the builder has moved on (a newer index
 * follows). An index made otherwise (none the mirror holds) has its input made here.
 */
async function askInput(index: RecordIndex, root: string, view: MapInput['view'], measure: string): Promise<MapInput | null> {
  const mirrored = mirrorOf(index.product);
  if (!mirrored || mirrored.records.byId !== index.byId || mirrored.folders !== index.folders) return productInput(index, root, view, measure);
  const reply = await askSpace({ type: 'input', product: index.product, seq: mirrored.seq, root, view, measure, held: holdsInput(index.product, root, view, measure) });
  if (!reply || reply.type !== 'input' || !reply.change) return null;
  return putInput(index, root, view, measure, reply.change);
}

/**
 * The input of a map of `index`: until a new one arrives from the worker, the input shown before, with the index it was
 * made for, whichever layout that was, so a layout's change never empties the stage or drops the keyboard's place in
 * it. Where the builder runs on this thread, it is made here, at once.
 */
export function useMapInput(index: RecordIndex, root: string, view: MapInput['view'], measure: string): { input: MapInput; of: RecordIndex } | null {
  const known = knownInput(index, root, view, measure) ?? (spaceInWorker() ? undefined : productInput(index, root, view, measure));
  const [shown, setShown] = useState<{ input: MapInput; of: RecordIndex } | null>(known ? { input: known, of: index } : null);
  useEffect(() => {
    if (known) { if (shown?.input !== known || shown.of !== index) setShown({ input: known, of: index }); return; }
    let live = true;
    void askInput(index, root, view, measure).then((input) => { if (live && input) setShown({ input, of: index }); });
    return () => { live = false; };
  }, [index, root, view, measure, known]);
  if (known) return { input: known, of: index };
  return shown && shown.of.product === index.product ? shown : null;
}
