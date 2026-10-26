// LA-PLT-T133 and LA-PLT-T134 (LA-PAT-APP-CODE-R21): nothing outlives its purpose, and a mark that can't be explained can't ship.
// Every mark the Graph or the Model view can draw (a box's shape or fill, a badge, a line style) is
// listed in that view's key, with words that say what it means.
import './graph/setup';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { relationStyle } from '../src/graph/GraphPage';
import { NAMES, PARENT } from '../src/graph/model';
import { Legend } from '../src/graph/panel';
import { erdFor } from '../src/model/erd';
import { ErdKey } from '../src/model/ModelView';
import { indexWorkspace } from '../src/specs/data';
import { eventWorkspace } from './fixtures/events';
import { testWorkspace } from './graph/workspace';

const CSS = readFileSync(path.resolve(import.meta.dirname, '../src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
/** The modifier classes a stylesheet gives an element class, as in `.graph-node.shape-stadium` or `.graph-mark.error`. */
const modifiers = (base: string) =>
  new Set([...CSS.matchAll(new RegExp(`\\.${base}((?:\\.[A-Za-z0-9_-]+)+)`, 'g'))].flatMap((m) => m[1].split('.').filter(Boolean)));
/** The words beside a key's mark: what the entry says it means. */
const meaning = (el: Element | null) => (el?.closest('li, tr')?.textContent ?? '').replace(/[!🟦⬜]|\bgap\b|\broot\b/g, '').trim();

afterEach(cleanup);

describe('the Graph view key', () => {
  // Classes that change how a box is laid out or drawn, not what it looks like it means: a centered label, a Nested box's
  // label moved into its header band, and a shape drawn by clipping (its shape's own class carries its meaning).
  const LAYOUT = new Set(['is-centered', 'is-container', 'is-clipped']);

  it('LA-PLT-T133 Every box look, badge and line style the Graph view can draw is in its key, with what it means', () => {
    const { container } = render(<Legend />);
    const entry = (selector: string) => container.querySelector(selector);
    const missing: string[] = [];
    const needs = (what: string, selector: string) => {
      const el = entry(selector);
      if (!el || meaning(el) === '') missing.push(`${what} (${selector})`);
    };
    for (const look of modifiers('graph-node')) {
      if (!LAYOUT.has(look)) needs(`box ${look}`, `.graph-swatch.${look}`);
    }
    needs('bar', '.graph-swatch.stage-bar');
    for (const badge of modifiers('graph-mark')) needs(`badge ${badge}`, `.graph-mark.${badge}`);
    const relations = [PARENT, NAMES, ...new Set(testWorkspace().relations.map((r) => r.relation))];
    for (const style of new Set(relations.map(relationStyle))) needs(`line ${style}`, `.graph-line.rel-${style}`);
    needs('cross-link', '.graph-line.is-link');
    expect(missing).toEqual([]);
  });
});

describe('the Model view key', () => {
  // Box and line classes that answer the pointer or the keyboard, not marks with a meaning.
  const INTERACTION = new Set(['is-focus', 'has-hover-label', 'has-event']);
  // Every class the stylesheet gives a box or a line, and what in the ERD draws it, checked below.
  const EXPLAINED = new Set(['tone-other', 'is-highlight', 'erd-event', 'is-dashed', 'rel-raised_by', 'rel-reacts_to', 'is-context']);

  it('LA-PLT-T134 Every mark a styled ERD box or line can carry is one the key test explains', () => {
    const styled = [...modifiers('erd-box'), ...modifiers('erd-line')].filter((c) => !INTERACTION.has(c));
    expect(styled.filter((c) => !EXPLAINED.has(c))).toEqual([]);
  });

  it('LA-PLT-T134 Every box, badge and line an ERD draws is in its key, with what it means', () => {
    const index = indexWorkspace(eventWorkspace());
    const scopes = index.workspace.records.filter((r) => ['domain', 'aggregate', 'entity'].includes(r.kind)).map((r) => r.id);
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
        if (box.kind === 'event') needs('event', box.highlight ? '.erd-key-event.is-highlight' : '.erd-key-event');
        else if (box.highlight) needs('highlighted box', '.erd-key-highlight');
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
