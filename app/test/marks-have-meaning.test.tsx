// LA-PLT-T133 and LA-PLT-T134 (LA-PAT-APP-CODE-R21): nothing outlives its purpose, and a mark that can't be explained can't ship.
// Every mark the Graph or the Model view can draw (a box's shape or fill, a badge, a line style) is
// listed in that view's key, with words that say what it means.
import './graph/setup';
import { indexOf } from './fixtures/load';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { relationStyle } from '../src/graph/GraphPage';
import { NAMES, PARENT } from '../src/graph/model';
import { Legend } from '../src/graph/panel';
import { BOX_LOOKS } from '../src/graph/paint';
import { BADGE_TONES } from '../src/graph/plate';
import { SHAPES } from '../src/graph/shapes';
import { erdFor } from '../src/model/erd';
import { ErdKey } from '../src/model/ModelView';
import { modelWorkspace } from './fixtures/model';
import { testWorkspace } from './graph/workspace';

const CSS = readFileSync(path.resolve(import.meta.dirname, '../src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
/** The modifier classes a stylesheet gives an element class, as in `.erd-box.erd-event`. */
const modifiers = (base: string) =>
  new Set([...CSS.matchAll(new RegExp(`\\.${base}((?:\\.[A-Za-z0-9_-]+)+)`, 'g'))].flatMap((m) => m[1].split('.').filter(Boolean)));
/** The words beside a key's mark: what the entry says it means. */
const meaning = (el: Element | null) => (el?.closest('li, tr')?.textContent ?? '').replace(/[!🟦⬜]|\bgap\b|\broot\b/g, '').trim();

afterEach(cleanup);

describe('the Graph view key', () => {
  it('LA-PLT-T133 Every box look, badge and line style the Graph view can draw is in its key, with what it means', () => {
    const { container } = render(<Legend />);
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
    const relations = [PARENT, NAMES, ...new Set(indexOf(testWorkspace()).workspace.relations.map((r) => r.relation))];
    for (const style of new Set(relations.map(relationStyle))) needs(`line ${style}`, `.graph-line.rel-${style}`);
    needs('cross-link', '.graph-line.is-link');
    expect(missing).toEqual([]);
  });
});

describe('the Model view key', () => {
  // Box and line classes that answer the pointer or the keyboard, not marks with a meaning.
  const INTERACTION = new Set(['is-focus', 'has-hover-label', 'has-event']);
  // Every class the stylesheet gives a box or a line, and what in the ERD draws it, checked below: each box kind's
  // event storming color (erd-<kind>, explained by its swatch), the other domain's tone, the highlight, dashes and fading.
  const KINDS = ['aggregate', 'entity', 'command', 'event', 'policy', 'specification', 'read_model', 'query'];
  const EXPLAINED = new Set(['tone-other', 'is-highlight', 'is-dashed', 'is-context', ...KINDS.map((k) => `erd-${k}`)]);

  it('LA-PLT-T134 Every mark a styled ERD box or line can carry is one the key test explains', () => {
    const styled = [...modifiers('erd-box'), ...modifiers('erd-line')].filter((c) => !INTERACTION.has(c));
    expect(styled.filter((c) => !EXPLAINED.has(c))).toEqual([]);
  });

  it('LA-PLT-T134 Every box, badge and line an ERD draws is in its key, with what it means', () => {
    const index = indexOf(modelWorkspace());
    const scopes = index.workspace.records.filter((r) => ['domain', 'aggregate', 'entity', 'command', 'domain_event', 'policy', 'read_model'].includes(r.kind)).map((r) => r.id);
    const missing: string[] = [];
    let drawn = 0;
    for (const scope of scopes) {
      const erd = erdFor(index, scope);
      if (!erd) continue;
      const { container, unmount } = render(<ErdKey erd={erd} highlight={erd.boxes.some((b) => b.highlight)} relations={index.workspace.relations} />);
      const needs = (what: string, selector: string) => {
        const el = container.querySelector(selector);
        if (!el || meaning(el) === '') missing.push(`${scope}: ${what} (${selector})`);
      };
      for (const line of erd.lines) {
        drawn++;
        needs(`line ${line.relation}`, `.erd-key-line.rel-${line.relation}${line.dashed ? '.is-dashed' : ''}`);
        if (line.context) needs('faded line', '.erd-key-context');
      }
      for (const box of erd.boxes) {
        drawn++;
        needs(`${box.tone} box`, `.tone-${box.tone}`);
        needs(`${box.kind} box`, `.erd-key-swatch.erd-key-${box.kind}`);
        if (box.highlight) needs('highlighted box', '.erd-key-highlight');
        if (box.root) needs('root badge', '.erd-root');
        if (box.context) needs('faded box', '.erd-key-context');
        // A box from elsewhere carries its owner in parentheses, which its color's row explains.
        if (box.foreign && !container.querySelector(`.tone-${box.tone}`)?.textContent?.includes('in parentheses')) missing.push(`${scope}: ${box.tone} box from elsewhere`);
      }
      unmount();
    }
    expect(drawn).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
