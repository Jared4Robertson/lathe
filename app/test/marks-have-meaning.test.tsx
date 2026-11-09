import { recordIndexOf } from './read-view';
// LA-PAT-APP-CODE-R21: nothing outlives its purpose, and a mark that can't be explained can't ship.
// Every mark the Graph or the ERD view can draw (a box's shape or fill, a badge, a line style) is
// listed in that view's key, with words that say what it means.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { graphKeyEntries, type GraphDrawn } from '../src/graph/key';
import { BOX_LOOKS } from '../src/graph/paint';
import { BADGE_TONES } from '../src/graph/plate';
import { MARKS, SHAPES, type Mark, type Shape } from '../src/graph/shapes';
import { erdFocus, erdStrength } from '../src/erd/erd';
import { erdOf } from './erd-of';
import { erdKeyEntries } from '../src/erd/ErdView';
import { changesKeyEntries, type ChangeMark } from '../src/changes/ChangesKey';
import { StageKey, type KeyEntry } from '../src/views/StageChrome';
import { modelWorkspace } from './fixtures/model';

/** The live marks every stage draws, and Highlight changes's dimming: each in every stage's key (changes/ChangesKey.tsx). */
const CHANGE_MARKS: ChangeMark[] = ['is-added', 'is-changed', 'is-removed', 'is-dimmed'];
const CHANGES = changesKeyEntries(new Set(CHANGE_MARKS));
/** The graph drawing every look, shape, mark and badge, in a layout. */
const everything = (layout: GraphDrawn['layout']): GraphDrawn => ({
  looks: new Set(BOX_LOOKS), shapes: new Set(Object.keys(SHAPES) as Shape[]), marks: new Set(Object.keys(MARKS) as Mark[]), badges: new Set(BADGE_TONES), layout });
/** A key bar of entries, each once. */
const bar = (entries: KeyEntry[]) => render(<StageKey entries={[...new Map(entries.map((e) => [e.id, e])).values()]} />);
/** The words beside a key's mark: what the entry says it means. */
const meaning = (el: Element | null) => (el?.closest('li, tr')?.textContent ?? '').replace(/[!🟦⬜]|\bgap\b|\broot\b/g, '').trim();

afterEach(cleanup);

describe('LA-V93-R12-T06 the Graph view key', () => {
  it('Every box look, badge and line style the Graph view can draw is in its key, with what it means', () => {
    // Each layout's key, together: every look, shape, mark and badge drawn, each layout's lines or boxes.
    const { container } = bar([...graphKeyEntries(everything('tree')), ...graphKeyEntries(everything('nested')), ...CHANGES]);
    const entry = (selector: string) => container.querySelector(selector);
    const missing: string[] = [];
    const needs = (what: string, selector: string) => {
      const el = entry(selector);
      if (!el || meaning(el) === '') missing.push(`${what} (${selector})`);
    };
    // Every look the canvas draws a box in (paint.ts), the focus's ring, each layout's boxes, and a bar.
    for (const look of BOX_LOOKS) needs(`box ${look}`, `.graph-swatch.${look}`);
    needs('the focus', '.graph-swatch.is-focus');
    for (const shape of Object.keys(SHAPES)) needs(`shape ${shape}`, `.graph-swatch.shape-${shape}`);
    needs('a Nested box', '.graph-swatch.stage-nested');
    needs('bar', '.graph-swatch.stage-bar');
    for (const badge of BADGE_TONES) needs(`badge ${badge}`, `.graph-mark.${badge}`);
    // The one line the graph draws: parent to child.
    needs('the parent line', '.graph-line');
    // The live marks (changes/marks.ts) and Highlight changes's dimming.
    for (const mark of CHANGE_MARKS) needs(`live mark ${mark}`, `.change-swatch.${mark}`);
    expect(missing).toEqual([]);
  });
});

describe('LA-V94-R05-T02 the ERD view key', () => {
  // The ERD is drawn on a canvas (erd/paint.ts): each kind of box, the root mark, the pick, the fade, each line's
  // relation and dashes, and the live marks. Each one any focus draws must be in that focus's key.
  it('Every box, badge and line an ERD draws is in its key, with what it means', () => {
    const data = modelWorkspace();
    const index = recordIndexOf(data);
    const focuses = [...index.byId.values()].filter((r) => ['product', 'domain', 'aggregate', 'entity'].includes(r.kind)).map((r) => r.id);
    const missing: string[] = [];
    let drawn = 0;
    for (const focus of focuses) {
      const at = erdFocus(index, focus);
      if (!at) continue;
      const map = erdOf(data, at.product);
      const strength = erdStrength(map, at.scope, { focusFade: 0.25 });
      const { container, unmount } = bar([...erdKeyEntries(map, at, index.meta.relations), ...CHANGES]);
      const needs = (what: string, selector: string) => {
        const el = container.querySelector(selector);
        if (!el || meaning(el) === '') missing.push(`${focus}: ${what} (${selector})`);
      };
      for (const line of map.lines) {
        drawn++;
        needs(`line ${line.relation}`, `.erd-key-line.rel-${line.relation}${line.dashed ? '.is-dashed' : ''}`);
        if (Math.min(strength(line.source), strength(line.target)) < 1) needs('faded line', '.erd-key-faded');
      }
      for (const box of map.boxes) {
        drawn++;
        needs(`${box.kind} box`, `.erd-key-swatch.erd-key-${box.kind}`);
        if (box.id === at.pick) needs('picked-out box', '.erd-key-highlight');
        if (box.root) needs('root badge', '.erd-root');
        if (strength(box.id) < 1) needs('faded box', '.erd-key-faded');
      }
      // A box the data's reload added or changed (has-change is-added, is-changed), a removed one's ghost, Highlight changes.
      for (const mark of CHANGE_MARKS) needs(`live mark ${mark}`, `.change-swatch.${mark}`);
      unmount();
    }
    expect(drawn).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
