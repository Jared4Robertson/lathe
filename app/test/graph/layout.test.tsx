import './setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { addRows } from '../fixtures/load';
import { recordIndexOf } from '../read-view';
import { testIndex, testWorkspace } from './workspace';
import { fitCache, placeTree, type PlacedMap } from '../../src/graph/map';
import { mapInput, probeOf, productInput, unpackInput, type LayoutReply, type LayoutRequest } from '../../src/graph/layout-input';
import { treeChildren } from '../../src/graph/tree';
import { textMeasure, treeLabel } from '../../src/graph/text';
import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';
import { layoutTree } from './maps';

// Every map is laid out off the main thread, and again only when what it reads changes (LA-EXP-DS05, LA-PLT-UC09-R13, layout.ts): its
// packed input is its key and what the layout's worker is sent; the map shown stays until the new one arrives.

const MEASURE = () => textMeasure().key;

describe('a map\'s layout input', () => {
  it('LA-EXP-DS05-T15 The worker lays out what the page would: its unpacked input places every box where the page places it', () => {
    const index = testIndex();
    const input = productInput(index, 'P', 'tree', MEASURE());
    const { shape, labels } = unpackInput(input.packed, input.shape.roots.map((r) => input.shape.ids.indexOf(r)));
    expect([...shape.parents]).toEqual([...input.shape.parents]);
    expect(labels.map((l) => [l.title, l.meta, l.shape, l.marks ?? 0, !!l.marked])).toEqual(input.labels.map((l) => [l.title, l.meta, l.shape, l.marks ?? 0, !!l.marked]));
    const here = placeTree(input.shape, (i) => input.labels[i]);
    expect([...placeTree(shape, (i) => labels[i]).boxes]).toEqual([...here.boxes]);
    // The same as the in-thread Tree layout.
    const map = layoutTree(['P'], (id) => treeChildren(index, id), (id) => treeLabel(index, id));
    input.shape.ids.forEach((id, i) => expect([map.nodes.get(id)!.x, map.nodes.get(id)!.w, map.nodes.get(id)!.text]).toEqual([here.boxes[i * 5], here.boxes[i * 5 + 2], here.boxes[i * 5 + 4]]));
  });

  it('LA-EXP-DS05-T15 A map is laid out again only when what it reads changes: new data that leaves it alone gives the same input', () => {
    const a = productInput(testIndex(), 'P', 'tree', MEASURE());
    const b = productInput(testIndex(), 'P', 'tree', MEASURE());
    expect(b).not.toBe(a);
    expect(b.packed).toBe(a.packed);
    // A retitled record changes it; so does another text measure, and the other layout.
    const data = testWorkspace();
    const changed = recordIndexOf(data);
    const record = [...changed.byId.values()].find((r) => r.kind === 'use_case')!;
    (record as { title: string }).title = `${record.title} again`;
    expect(productInput(changed, 'P', 'tree', MEASURE()).packed).not.toBe(a.packed);
    expect(productInput(testIndex(), 'P', 'tree', 'another measure').packed).not.toBe(a.packed);
    expect(productInput(testIndex(), 'P', 'nested', MEASURE()).packed).not.toBe(a.packed);
  });

  it('LA-EXP-DS05-T15 Kept fits lay a changed map out as a fresh layout does', () => {
    const cache = fitCache();
    const index = testIndex();
    const input = productInput(index, 'P', 'tree', MEASURE());
    placeTree(input.shape, (i) => input.labels[i], cache);
    const data = testWorkspace();
    addRows(data, 'use_case', { id: 'P-D-UC09', title: 'Lend a thing to a neighbor for a week', capability_id: 'P-D-CAP01', goal: 'A member lends a thing.' });
    const next = mapInput('tree', ['P'], (id) => treeChildren(recordIndexOf(data), id), (id) => treeLabel(recordIndexOf(data), id), MEASURE());
    expect([...placeTree(next.shape, (i) => next.labels[i], cache).boxes]).toEqual([...placeTree(next.shape, (i) => next.labels[i]).boxes]);
  });
});

/** A worker the test answers by hand: it measures as the page does, and lays a map out only when told to. */
class HeldWorker {
  static last: HeldWorker | null = null;
  onmessage: ((e: MessageEvent<LayoutReply>) => void) | null = null;
  onerror: (() => void) | null = null;
  held: Extract<LayoutRequest, { type: 'layout' }>[] = [];
  constructor() { HeldWorker.last = this; }
  postMessage(message: LayoutRequest) {
    if (message.type === 'fonts') setTimeout(() => this.onmessage?.({ data: { type: 'ready', measure: textMeasure().key, probe: probeOf(textMeasure()) } } as MessageEvent<LayoutReply>));
    else this.held.push(message);
  }
  /** Lays out the request waiting, as the worker does. */
  release() {
    const m = this.held.shift()!;
    const { shape, labels } = unpackInput(m.packed, m.roots);
    const g = placeTree(shape, (i) => labels[i]);
    this.onmessage?.({ data: { type: 'laid', id: m.id, boxes: g.boxes, width: g.width, height: g.height, ms: 1 } } as MessageEvent<LayoutReply>);
  }
  terminate() {}
}

describe('the layout\'s worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('LA-EXP-DS05-T15 The map shown stays, with the index it was laid out from, until the new one arrives from the worker', async () => {
    vi.stubGlobal('Worker', HeldWorker);
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.resetModules();
    const { useLaidOut, lastLayout } = await import('../../src/graph/layout');
    const fonts = { body: 'sans-serif', mono: 'monospace' };
    const seen: { map: PlacedMap; of: RecordIndex }[] = [];
    function Probe({ index }: { index: RecordIndex }) {
      const laid = useLaidOut<PlacedMap, RecordIndex>(productInput(index, 'P', 'tree', MEASURE()), index, fonts);
      if (laid) seen.push(laid);
      return null;
    }
    const first = testIndex();
    const view = render(<Probe index={first} />);
    // Nothing until the first layout arrives.
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(seen).toHaveLength(0);
    await act(async () => { HeldWorker.last!.release(); await new Promise((r) => setTimeout(r, 0)); });
    const shown = seen.at(-1)!;
    expect(shown.of).toBe(first);
    expect(lastLayout()?.thread).toBe('worker');
    // New data that changes the map: the old map stays, with its own index, while the new one is laid out.
    const data = testWorkspace();
    addRows(data, 'use_case', { id: 'P-D-UC09', title: 'Lend a thing to a neighbor for a week', capability_id: 'P-D-CAP01', goal: 'A member lends a thing.' });
    const second = recordIndexOf(data);
    view.rerender(<Probe index={second} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(seen.at(-1)!.map).toBe(shown.map);
    expect(seen.at(-1)!.of).toBe(first);
    expect(shown.map.nodes.has('P-D-UC09')).toBe(false);
    await act(async () => { HeldWorker.last!.release(); await new Promise((r) => setTimeout(r, 0)); });
    expect(seen.at(-1)!.of).toBe(second);
    expect(seen.at(-1)!.map.nodes.has('P-D-UC09')).toBe(true);
    // New data that leaves the map alone reads the same map at once: nothing is sent to the worker.
    view.rerender(<Probe index={testIndex()} />);
    expect(HeldWorker.last!.held).toHaveLength(0);
    const again = seen.at(-1)!;
    expect(again.map).toBe(shown.map);
  });
});
