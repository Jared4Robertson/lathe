import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { endPath, erdFocus, erdMap, erdStrength, lineGeometry, lineOffsets, scopeContents } from '../src/erd/erd';
import { erdLayout, groupGraph, layoutErd, readyErdLayout } from '../src/erd/layout';
import { DRAW_IN_VIEW_PAST, ErdKey, FIT_MARGIN, fitRects, framedRects, lineWords } from '../src/erd/ErdView';
import { openApp } from './helpers';
import { modelIndex, modelWorkspace } from './fixtures/model';

// The ERD stage: one map of the whole product (each domain a region, its aggregates boundaries
// around their entities), laid out once, that every focus navigates: the focus fades what lies
// outside its scope, picks out its box, and the camera frames it. It works on every focus
// (LA-PAT-APP-UX-R17).

const served = () => ({ data: modelWorkspace() });
const index = () => modelIndex();
const modelPane = () => screen.getByRole('region', { name: 'ERD stage' });
const box = (id: string) => modelPane().querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const boxesShown = () => waitFor(() => expect(modelPane().querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const LOOK = { focusFade: 0.25 };
const ends = (lines: { id: string; sourceEnd: string; targetEnd: string; dashed: boolean }[]) =>
  Object.fromEntries(lines.map((l) => [l.id, `${l.sourceEnd}-${l.targetEnd}${l.dashed ? ' dashed' : ''}`]));
/** Every box's place on the page, as React Flow draws it. */
const places = () => Object.fromEntries([...modelPane().querySelectorAll<HTMLElement>('.react-flow__node')].map((n) => [n.dataset.id, `${n.style.transform} ${n.style.width}x${n.style.height}`]));

describe('the ERD stage', () => {
  const proveErdOnEveryFocus = async () => {
    const i = index();
    // A domain, an aggregate and an entity: their own box, picked out and framed.
    expect(erdFocus(i, 'P-D')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D' });
    expect(erdFocus(i, 'P-D-A3')).toEqual({ product: 'P', scope: 'P-D-A3', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D-EN03')).toEqual({ product: 'P', scope: 'P-D-A3', pick: 'P-D-EN03' });
    // Any other record: its domain in scope, its nearest entity or aggregate picked out when it has one; a table its entity.
    expect(erdFocus(i, 'P-D-UC01')).toEqual({ product: 'P', scope: 'P-D', pick: null });
    expect(erdFocus(i, 'P-D-CMD01')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D-CMD01-H')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D-EV02')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D-EN03-TB')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-EN03' });
    // A group: its owner's. A Shared record and a product: the whole product.
    expect(erdFocus(i, 'P-D-A3/invariant')).toEqual({ product: 'P', scope: 'P-D-A3', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D/use-cases')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D' });
    expect(erdFocus(i, 'P-VO01')).toEqual({ product: 'P', scope: 'P', pick: null });
    expect(erdFocus(i, 'P')).toEqual({ product: 'P', scope: 'P', pick: null });
    expect(erdFocus(i, 'NOPE')).toBeNull();
    // Every focus frames something on the one map.
    const map = erdMap(i, 'P');
    const rects = await layoutErd(map);
    for (const id of ['P', 'P-D-UC01', 'P-VO01', 'P-D-UC01-FL01', 'P-D-CMD01', 'P-D-EV01', 'P-D-PO01', 'P-D-RM01', 'P-D-QRY01', 'P-D-SP01']) {
      expect(framedRects(rects, map, erdFocus(i, id)!).length, id).toBeGreaterThan(0);
    }
    // The product frames the whole map; a use case its domain's region; a command its aggregate.
    expect(framedRects(rects, map, erdFocus(i, 'P')!)).toHaveLength(rects.size);
    expect(framedRects(rects, map, erdFocus(i, 'P-D-UC01')!)).toEqual([rects.get('P-D')]);
    expect(framedRects(rects, map, erdFocus(i, 'P-D-CMD01')!)).toEqual([rects.get('P-D-A3')]);

    // The switch always offers the ERD: on a use case it draws the map, its domain in focus.
    await openApp('/P-D-UC01?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    expect(stageButton('ERD')).not.toHaveAttribute('aria-disabled');
    await boxesShown();
    expect(box('P-D-A3')).toHaveAttribute('aria-label', 'Aggregate Loan');
    expect(box('P-E-A1')).toHaveAttribute('aria-hidden', 'true');

    // On an aggregate: Ctrl+2 switches to the ERD stage, Alt+G back to the graph (off a Mac).
    await openApp('/P-D-A3?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });
    expect(window.location.search).toBe('?stage=erd');
    await boxesShown();
    fireEvent.keyDown(document.body, { key: 'g', code: 'KeyG', altKey: true });
    expect(window.location.search).toBe('?stage=graph');
  };
  it('LA-V96-R18-T01 Every focus has an ERD stage: a domain, an aggregate or an entity frames its own box, any other record its nearest entity or aggregate, or its domain or product', proveErdOnEveryFocus);
  it('LA-V94-R07-T01 Any other record frames its nearest entity or aggregate in its domain, a Shared record and the product the whole map', proveErdOnEveryFocus);

  const proveLaV94R02T01 = async () => {
    const map = erdMap(index(), 'P');
    const byId = new Map(map.boxes.map((b) => [b.id, b]));
    // Domains, aggregates and entities only: no command, event, policy, specification, read model or query.
    expect([...new Set(map.boxes.map((b) => b.kind))].sort()).toEqual(['aggregate', 'domain', 'entity']);
    expect(map.boxes.filter((b) => b.kind === 'domain').map((b) => b.id)).toEqual(['P-D', 'P-E']);
    expect(map.boxes.filter((b) => b.parent === 'P-D').map((b) => b.id)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4']);
    expect(map.boxes.filter((b) => b.parent === 'P-D-A3').map((b) => [b.id, b.root])).toEqual([['P-D-EN03', true], ['P-D-EN04', false], ['P-D-EN05', false]]);
    expect(byId.get('P-D-EN03')!.fields).toEqual([{ field: 'Loan ID', kind: 'whole number' }, { field: 'Thing', kind: '→ Thing' }, { field: 'Member', kind: '→ Member' }, { field: 'Due date', kind: 'date' }]);
    expect(byId.get('P-D-EN01')!.fields).toContainEqual({ field: 'Name', kind: 'Name' });
    // Has one and has many between entities, with crow's feet; a dashed reference from the field's entity to the
    // other aggregate's root, across regions for another domain's.
    expect(ends(map.lines)).toEqual({
      'P-D-EN03|has_one|P-D-EN04': 'one-one',
      'P-D-EN03|has_many|P-D-EN05': 'one-many',
      'P-D-EN02|references|P-E-EN01': 'none-arrow dashed',
      'P-D-EN03|references|P-D-EN01': 'none-arrow dashed',
      'P-D-EN03|references|P-D-EN02': 'none-arrow dashed',
      'P-D-EN05|references|P-D-EN02': 'none-arrow dashed',
      'P-D-EN06|references|P-D-EN01': 'none-arrow dashed',
    });
    expect(map.lines.find((l) => l.id === 'P-D-EN02|references|P-E-EN01')).toMatchObject({ via: ['Member.Account'] });
    // A region lays out its aggregates along the references between them; the product its regions, along those between domains.
    const sizes = new Map<string, { width: number; height: number }>();
    expect(groupGraph(map, 'P-D', sizes).edges).toEqual(expect.arrayContaining([expect.objectContaining({ sources: ['P-D-A3'], targets: ['P-D-A2'] })]));
    expect(groupGraph(map, 'P-D', sizes).children!.map((c) => c.id)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4']);
    expect(groupGraph(map, undefined, sizes).edges).toEqual([expect.objectContaining({ sources: ['P-D'], targets: ['P-E'] })]);
    // Each box sits inside its parent, below its head.
    const rects = await layoutErd(map);
    for (const b of map.boxes.filter((x) => x.parent)) {
      const r = rects.get(b.id)!;
      const at = rects.get(b.parent!)!;
      expect(r.x).toBeGreaterThanOrEqual(at.x);
      expect(r.y).toBeGreaterThan(at.y + 30);
      expect(r.x + r.width).toBeLessThanOrEqual(at.x + at.width);
      expect(r.y + r.height).toBeLessThanOrEqual(at.y + at.height);
    }

    await openApp('/P?stage=erd', served());
    await screen.findAllByRole('heading', { level: 1 });
    await boxesShown();
    expect(box('P-D')!.querySelector('.erd-box')).toHaveClass('erd-domain');
    expect(box('P-D')).toHaveAttribute('aria-label', 'Domain Domain');
    expect(box('P-E')).toHaveTextContent('Accounts');
    expect(box('P-D-A3')!.querySelector('.erd-box')).toHaveClass('erd-aggregate');
    expect(box('P-D-EN03')).toHaveAttribute('aria-label', 'Entity Loan, root');
    expect(within(box('P-D-EN03')!).getByRole('list', { name: 'Fields of Loan' })).toHaveTextContent('Thing→ Thing');
    expect(modelPane().querySelector('.erd-command, .erd-event, .erd-policy')).toBeNull();
    await waitFor(() => expect(modelPane().querySelectorAll('.erd-line')).toHaveLength(map.lines.length));
    expect(modelPane().querySelector('[data-line="P-D-EN03|references|P-D-EN02"]')).toHaveClass('is-dashed', 'has-hover-label');
    expect(modelPane().querySelector('[data-line="P-D-EN03|references|P-D-EN02"] title')).toHaveTextContent('Loan references by ID Member (Loan.Member)');
    expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"] title')).toHaveTextContent('Loan has many Reminder');
    // The product's focus fades nothing.
    expect(modelPane().querySelector('.is-faded')).toBeNull();
  };
  it('LA-V94-R02-T01 The map draws each aggregate as a boundary around its entities with their fields, has one and has many lines with crow\'s feet, and a dashed reference from an entity to another aggregate\'s root', proveLaV94R02T01);
  it('LA-V94-R01-T01 The map draws each domain as a region around its aggregates, and a reference to another domain\'s aggregate between regions', proveLaV94R02T01);

  const proveLaV94R03T01 = async () => {
    const map = erdMap(index(), 'P');
    const strength = erdStrength(map, 'P-D-A3', LOOK);
    // The aggregate and its entities at full strength, the rest, its domain's region among them, faded back (the shared keptFade).
    expect(['P-D-A3', 'P-D-EN03', 'P-D-EN04', 'P-D-EN05'].map(strength)).toEqual([1, 1, 1, 1]);
    expect(['P-D', 'P-D-A1', 'P-D-EN01', 'P-E', 'P-E-A1'].map(strength)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25]);
    // Its scope: its entities, and the lines with an end in it, the references to the aggregates around it among them.
    expect(ends(scopeContents(map, 'P-D-A3').lines)).toEqual({
      'P-D-EN03|has_one|P-D-EN04': 'one-one',
      'P-D-EN03|has_many|P-D-EN05': 'one-many',
      'P-D-EN03|references|P-D-EN01': 'none-arrow dashed',
      'P-D-EN03|references|P-D-EN02': 'none-arrow dashed',
      'P-D-EN05|references|P-D-EN02': 'none-arrow dashed',
    });
    // A crow's foot has three prongs and a bar; one is two bars; an arrow one stroke.
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'many').match(/M/g)).toHaveLength(4);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'one').match(/M/g)).toHaveLength(2);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'arrow').match(/M/g)).toHaveLength(1);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'none')).toBe('');
    // Lines run from box edge to box edge, and lines between the same two boxes fan out.
    const g = lineGeometry({ x: 0, y: 0, width: 100, height: 50 }, { x: 300, y: 0, width: 100, height: 50 }, ['one', 'many']);
    expect(g.from).toEqual({ x: 100, y: 25 });
    expect(g.to).toEqual({ x: 300, y: 25 });
    const line = map.lines[0];
    const offsets = lineOffsets([{ ...line, id: 'a' }, { ...line, id: 'b' }]);
    expect(offsets.get('a')).not.toBe(offsets.get('b'));

    await openApp('/P-D-A3?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await boxesShown();
    const loan = box('P-D-EN03')!;
    expect(within(loan).getByText('root')).toHaveClass('erd-root');
    const fields = within(within(loan).getByRole('list', { name: 'Fields of Loan' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(fields).toEqual(['Loan IDwhole number', 'Thing→ Thing', 'Member→ Member', 'Due datedate']);
    expect(box('P-D-A3')!.querySelector('.erd-box')).toHaveClass('is-highlight', 'is-focus');
    expect(box('P-D-A1')!.querySelector('.erd-box')).toHaveClass('is-faded');
    expect(box('P-D-A1')!.querySelector<HTMLElement>('.erd-box')!.style.getPropertyValue('--erd-strength')).toBe('0.25');
    // A line to a faded box fades with it.
    await waitFor(() => expect(modelPane().querySelector('[data-line="P-D-EN03|references|P-D-EN01"]')).toHaveClass('is-faded'));
    expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"]')).toHaveAttribute('data-ends', 'one-many');
    expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"]')).not.toHaveClass('is-faded');
  };
  it('LA-V94-R03-T01 An aggregate\'s focus keeps its boundary, entities, fields and lines at full strength, its domain a trail, and fades the rest', proveLaV94R03T01);
  it('LA-V94-R01-T02 An aggregate\'s focus fades the aggregates it references, and its lines to them', proveLaV94R03T01);

  it('LA-V94-R04-T01 An entity\'s focus keeps its aggregate at full strength, picks the entity out and frames it', async () => {
    const i = index();
    const map = erdMap(i, 'P');
    const rects = await layoutErd(map);
    expect(framedRects(rects, map, erdFocus(i, 'P-D-EN04')!)).toEqual([rects.get('P-D-EN04')]);
    expect(erdStrength(map, erdFocus(i, 'P-D-EN04')!.scope, LOOK)('P-D-EN03')).toBe(1);

    await openApp('/P-D-EN04?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Return' });
    await boxesShown();
    expect(box('P-D-EN04')!.querySelector('.erd-box')).toHaveClass('is-highlight', 'is-focus');
    expect(box('P-D-EN04')).toHaveAttribute('aria-label', 'Entity Return (picked out)');
    expect(box('P-D-EN03')!.querySelector('.erd-box')).not.toHaveClass('is-highlight');
    expect(within(modelPane()).getByRole('group', { name: 'Key' })).toHaveTextContent('Picked out');
  });

  it('LA-V94-R05-T01 Clicking a box goes to it, boxes show a hover state, and a key under the map lists only the boxes and lines drawn', async () => {
    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const key = within(modelPane()).getByRole('group', { name: 'Key' });
    const boxes = within(key).getByRole('list', { name: 'Boxes' });
    expect(within(boxes).getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual(['Domain', 'Aggregate boundary', 'Entity', 'root Root entity', 'Picked out', 'Faded: out of focus']);
    const lines = within(key).getByRole('list', { name: 'Lines' });
    expect(within(lines).getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual(['Has one (1:1)', 'Has many (1:n)', 'Reference by ID']);
    expect(lines.querySelector('.erd-key-line.rel-references.is-dashed')).not.toBeNull();
    expect(lines.querySelector('.erd-key-line.rel-has_many:not(.is-dashed)')).not.toBeNull();
    // Under the map, keeping one height.
    expect(modelPane().querySelector('.erd-canvas')!.compareDocumentPosition(key.closest('.erd-key')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(CSS).toMatch(/\.erd-key\s*\{[^}]*block-size:\s*var\(--erd-key-height\)/);
    fireEvent.click(box('P-D-A3')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-A3?stage=erd');
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    // Enter on a focused box goes to it too.
    fireEvent.keyDown(box('P-D-EN05')!, { key: 'Enter' });
    expect(window.location.pathname).toBe('/P-D-EN05');
    // Hover (LA-PAT-APP-UX-R01) on the shared ring and speed, off under reduced motion.
    expect(CSS).toMatch(/\.erd-box:not\(\.is-focus\):hover\s*\{[^}]*var\(--hover-ring\)/);
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*transition:\s*box-shadow var\(--hover-speed\)/);
    // Colors come from the domain model stage's tokens.
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*var\(--g-domain-model\)/);
    expect(CSS).toMatch(/\.erd-box\.erd-aggregate\s*\{[^}]*var\(--g-domain-model-bg\)/);
  });

  it('LA-V94-R06-T01 A domain\'s focus fades the other domains\' regions, out of focus and out of the keyboard order, the fade easing on the shared motion', async () => {
    const map = erdMap(index(), 'P');
    const strength = erdStrength(map, 'P-D', LOOK);
    expect(map.boxes.filter((b) => strength(b.id) < 1).map((b) => b.id)).toEqual(['P-E', 'P-E-A1', 'P-E-EN01']);
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*opacity:\s*var\(--erd-strength, 1\)[^}]*opacity var\(--motion-speed\) var\(--motion-ease\)/);
    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    expect(box('P-E-A1')).toHaveAttribute('aria-hidden', 'true');
    expect(box('P-E-A1')).not.toHaveAttribute('tabindex');
    expect(box('P-D-A1')).toHaveAttribute('tabindex', '0');
    expect(box('P-D-A1')).not.toHaveAttribute('aria-hidden');
  });

  it('LA-V94-R06-T02 The frame fits what it frames inside the margin at any canvas size and inside the open space, never zoomed in past 1', async () => {
    const rects = await layoutErd(erdMap(index(), 'P'));
    for (const framed of [[...rects.values()], [rects.get('P-D-A3')!], [rects.get('P-D-EN04')!]]) {
      for (const [width, height] of [[1200, 700], [600, 500], [320, 260]]) {
        const v = fitRects(framed, width, height);
        for (const r of framed) {
          expect(v.x + r.x * v.zoom).toBeGreaterThanOrEqual(FIT_MARGIN.left - 0.5);
          expect(v.y + r.y * v.zoom).toBeGreaterThanOrEqual(FIT_MARGIN.top - 0.5);
          expect(v.x + (r.x + r.width) * v.zoom).toBeLessThanOrEqual(width - FIT_MARGIN.right + 0.5);
          expect(v.y + (r.y + r.height) * v.zoom).toBeLessThanOrEqual(height - FIT_MARGIN.bottom + 0.5);
        }
        expect(v.zoom).toBeLessThanOrEqual(1);
      }
    }
    // In the open space the host's panels leave: the margin grows by their insets, so every box sits between them.
    const open = { left: FIT_MARGIN.left + 400, right: FIT_MARGIN.right + 300, top: FIT_MARGIN.top + 80, bottom: FIT_MARGIN.bottom };
    const v = fitRects(rects.values(), 1400, 900, open);
    for (const r of rects.values()) {
      expect(v.x + r.x * v.zoom).toBeGreaterThanOrEqual(open.left - 0.5);
      expect(v.x + (r.x + r.width) * v.zoom).toBeLessThanOrEqual(1400 - open.right + 0.5);
      expect(v.y + r.y * v.zoom).toBeGreaterThanOrEqual(open.top - 0.5);
    }
  });

  const proveOneMap = async () => {
    const i = index();
    const map = erdMap(i, 'P');
    // One map and one layout per product and data change (the spec's index): asked again, the same ones.
    expect(erdMap(i, 'P')).toBe(map);
    const rects = await erdLayout(i, 'P');
    expect(await erdLayout(i, 'P')).toBe(rects);
    expect(readyErdLayout(i, 'P')).toBe(rects);
    // New data (a new index) is laid out anew, once; the map's size decides whether it draws only what is in view.
    const again = index();
    expect(erdMap(again, 'P')).not.toBe(map);
    expect(readyErdLayout(again, 'P')).toBeUndefined();
    expect(await erdLayout(again, 'P')).toEqual(rects);
    expect(map.boxes.length).toBeLessThanOrEqual(DRAW_IN_VIEW_PAST);

    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const before = places();
    expect(Object.keys(before)).toHaveLength(map.boxes.length);
    // Focusing an aggregate, then an entity: only the fade and the pick change.
    fireEvent.click(box('P-D-A3')!);
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(places()).toEqual(before);
    fireEvent.keyDown(box('P-D-EN05')!, { key: 'Enter' });
    await screen.findByRole('heading', { level: 1, name: 'Reminder' });
    await waitFor(() => expect(box('P-D-EN05')!.querySelector('.erd-box')).toHaveClass('is-highlight'));
    expect(places()).toEqual(before);
  };
  it('LA-V94-R08-T01 The map is laid out once: focusing two records moves no box and changes no size, and the layout is read again, never redone', proveOneMap);
  it('LA-PAT-APP-UX-R19-T02 The ERD map is laid out once: focusing two records moves no box, and the layout is read again for the same data', proveOneMap);

  it('LA-EXP-DS11-T01 The map draws exactly one line per relationship link and one per entity and aggregate it references', () => {
    const i = index();
    const map = erdMap(i, 'P');
    const entities = new Set(map.boxes.filter((b) => b.kind === 'entity').map((b) => b.id));
    const links = i.workspace.links.filter((l) => ['has_one', 'has_many'].includes(l.relation) && entities.has(l.source));
    expect(links.length).toBe(2);
    for (const l of links) expect(map.lines.filter((x) => x.source === l.source && x.target === l.target && x.relation === l.relation)).toHaveLength(1);
    // Loan's two references to Member come from two entities: two lines; its Thing one line.
    expect(map.lines.filter((l) => l.relation === 'references')).toHaveLength(5);
    const ids = map.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A line's words read from its source, the reference's fields its hover label.
    const ref = map.lines.find((l) => l.id === 'P-D-EN05|references|P-D-EN02')!;
    const titles = new Map(map.boxes.map((b) => [b.id, b.title]));
    expect(lineWords(ref, 'References by ID', titles)).toEqual({ label: 'references by ID', title: 'Reminder references by ID Member (Reminder.Member)', hover: 'Reminder.Member' });
    render(<ErdKey map={map} at={erdFocus(i, 'P')!} relations={i.workspace.relations} />);
    expect(within(screen.getByRole('group', { name: 'Key' })).getByText('Reference by ID').closest('li')).toHaveAttribute('title', "A field holds the other aggregate's ID; the line points at its root.");
  });
});
