// LA-PAT-APP-CODE-R21: nothing outlives its purpose, and a mark that can't be explained can't ship.
// Every mark the Graph or the ERD view can draw (a box's shape or fill, a badge, a line style) is
// listed in that view's key, with words that say what it means.
import './graph/setup';
import { indexOf } from './fixtures/load';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GraphKey } from '../src/graph/key';
import { BOX_LOOKS } from '../src/graph/paint';
import { BADGE_TONES } from '../src/graph/plate';
import { SHAPES } from '../src/graph/shapes';
import { erdFocus, erdMap, erdStrength } from '../src/erd/erd';
import { ErdKey } from '../src/erd/ErdView';
import { modelWorkspace } from './fixtures/model';

const CSS = readFileSync(path.resolve(import.meta.dirname, '../src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
/** The modifier classes a stylesheet gives an element class, as in `.erd-box.erd-aggregate`. */
const modifiers = (base: string) =>
  new Set([...CSS.matchAll(new RegExp(`\\.${base}((?:\\.[A-Za-z0-9_-]+)+)`, 'g'))].flatMap((m) => m[1].split('.').filter(Boolean)));
/** The words beside a key's mark: what the entry says it means. */
const meaning = (el: Element | null) => (el?.closest('li, tr')?.textContent ?? '').replace(/[!🟦⬜]|\bgap\b|\broot\b/g, '').trim();

afterEach(cleanup);

describe('LA-V93-R12-T06 the Graph view key', () => {
  it('Every box look, badge and line style the Graph view can draw is in its key, with what it means', () => {
    const { container } = render(<GraphKey />);
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
    needs('a Voronoi cell', '.graph-swatch.is-cell');
    needs('bar', '.graph-swatch.stage-bar');
    for (const badge of BADGE_TONES) needs(`badge ${badge}`, `.graph-mark.${badge}`);
    // The one line the graph draws: parent to child.
    needs('the parent line', '.graph-line');
    expect(missing).toEqual([]);
  });
});

describe('LA-V94-R05-T02 the ERD view key', () => {
  // Box and line classes that answer the pointer or the keyboard, not marks with a meaning.
  const INTERACTION = new Set(['is-focus', 'has-hover-label']);
  // Every class the stylesheet gives a box or a line, and what in the ERD draws it, checked below: each box kind
  // (erd-<kind>, explained by its swatch), the pick, dashes and fading.
  const EXPLAINED = new Set(['erd-domain', 'erd-aggregate', 'erd-entity', 'is-highlight', 'is-dashed', 'is-faded']);

  it('Every mark a styled ERD box or line can carry is one the key test explains', () => {
    const styled = [...modifiers('erd-box'), ...modifiers('erd-line')].filter((c) => !INTERACTION.has(c));
    expect(styled.filter((c) => !EXPLAINED.has(c))).toEqual([]);
  });

  it('Every box, badge and line an ERD draws is in its key, with what it means', () => {
    const index = indexOf(modelWorkspace());
    const focuses = index.workspace.records.filter((r) => ['product', 'domain', 'aggregate', 'entity'].includes(r.kind)).map((r) => r.id);
    const missing: string[] = [];
    let drawn = 0;
    for (const focus of focuses) {
      const at = erdFocus(index, focus);
      if (!at) continue;
      const map = erdMap(index, at.product);
      const strength = erdStrength(map, at.scope, { focusFade: 0.25 });
      const { container, unmount } = render(<ErdKey map={map} at={at} relations={index.workspace.relations} />);
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
      unmount();
    }
    expect(drawn).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
