import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { endPath, erdFocus, type ErdMap, erdStrength, lineGeometry, lineOffsets, scopeContents } from '../src/erd/erd';
import { erdLayout, groupGraph, layoutErd, layoutRegion, readyErdLayout } from '../src/erd/layout';
import { elkLayout } from '../src/elk';
import { DRAW_IN_VIEW_PAST, erdKeyEntries, FIT_MARGIN, fitRects, framedRects, lineWords } from '../src/erd/ErdView';
import { StageKey } from '../src/views/StageChrome';
import { openApp } from './helpers';
import { modelIndex, modelWorkspace } from './fixtures/model';
import { erdOf } from './erd-of';
import { erdBox, erdDrawn, erdNode, erdPlaces, erdScene, hoverMapPoint } from './erd-scene';
import { boxEdge, type ErdLook } from '../src/erd/paint';
import { PLAIN_LOOK } from '../src/graph/look';

// The ERD stage: one map of the whole product (each domain a region, its aggregates boundaries
// around their entities), laid out once, that every focus navigates: the focus fades what lies
// outside its scope, picks out its box, and the camera frames it. It works on every focus
// (LA-PAT-APP-UX-R17).

const served = () => ({ data: modelWorkspace() });
const index = () => modelIndex();
/** The model product's map, as the ERD read answers it. */
const modelMap = () => erdOf(modelWorkspace(), 'P');
const modelPane = () => screen.getByRole('region', { name: 'ERD stage' });
const box = (id: string) => erdNode(id, modelPane());
const drawn = (id: string) => erdBox(id, modelPane())!;
const lineOf = (id: string) => erdScene(modelPane(), true).lines.find((l) => l.id === id)!;
const boxesShown = () => waitFor(() => expect(erdDrawn(modelPane())).toBe(true));
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const LOOK = { focusFade: 0.25 };
const ends = (lines: { id: string; sourceEnd: string; targetEnd: string; dashed: boolean }[]) =>
  Object.fromEntries(lines.map((l) => [l.id, `${l.sourceEnd}-${l.targetEnd}${l.dashed ? ' dashed' : ''}`]));
/** Every box's place on the map, as the canvas draws it. */
const places = () => erdPlaces(modelPane());

describe('the ERD stage', () => {
  const proveErdOnEveryFocus = async () => {
    const i = index();
    // A domain, an aggregate and an entity: their own box, picked out and framed.
    expect(erdFocus(i, 'P-D')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D' });
    expect(erdFocus(i, 'P-D-A3')).toEqual({ product: 'P', scope: 'P-D-A3', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D-EN03')).toEqual({ product: 'P', scope: 'P-D-A3', pick: 'P-D-EN03' });
    // Any other record: its domain in scope, its nearest entity or aggregate picked out when it has one; a table its entity.
    expect(erdFocus(i, 'P-D-UC01')).toEqual({ product: 'P', scope: 'P-D', pick: null });
    expect(erdFocus(i, 'P-D-CMD01')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-EN03' });
    expect(erdFocus(i, 'P-D-CMD01-H')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-EN03' });
    expect(erdFocus(i, 'P-D-EV02')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D-EN03-TB')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D-EN03' });
    // A group: its owner's. A Shared record and a product: the whole product.
    expect(erdFocus(i, 'P-D-A3/invariant')).toEqual({ product: 'P', scope: 'P-D-A3', pick: 'P-D-A3' });
    expect(erdFocus(i, 'P-D/use-cases')).toEqual({ product: 'P', scope: 'P-D', pick: 'P-D' });
    expect(erdFocus(i, 'P-VO01')).toEqual({ product: 'P', scope: 'P', pick: null });
    expect(erdFocus(i, 'P')).toEqual({ product: 'P', scope: 'P', pick: null });
    expect(erdFocus(i, 'NOPE')).toBeNull();
    // Every focus frames something on the one map.
    const map = modelMap();
    const rects = await layoutErd(map);
    for (const id of ['P', 'P-D-UC01', 'P-VO01', 'P-D-UC01-FL', 'P-D-CMD01', 'P-D-EV01', 'P-D-PO01', 'P-D-RM01', 'P-D-QRY01', 'P-D-SP01']) {
      expect(framedRects(rects, map, erdFocus(i, id)!).length, id).toBeGreaterThan(0);
    }
    // The product frames the whole map; a use case its domain's region; a command the entity it changes.
    expect(framedRects(rects, map, erdFocus(i, 'P')!)).toHaveLength(rects.size);
    expect(framedRects(rects, map, erdFocus(i, 'P-D-UC01')!)).toEqual([rects.get('P-D')]);
    expect(framedRects(rects, map, erdFocus(i, 'P-D-CMD01')!)).toEqual([rects.get('P-D-EN03')]);

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
    const map = modelMap();
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
      'P-D-EN06|references|P-D-EN01': 'none-arrow dashed' });
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
    expect(drawn('P-D')).toMatchObject({ kind: 'domain', title: ['Domain'] });
    expect(box('P-D')).toHaveAttribute('aria-label', 'Domain Domain');
    expect(drawn('P-E').title).toEqual(['Accounts']);
    expect(drawn('P-D-A3')).toMatchObject({ kind: 'aggregate', kindLine: 'Aggregate' });
    expect(box('P-D-EN03')).toHaveAttribute('aria-label', 'Entity Loan, root');
    expect(drawn('P-D-EN03')).toMatchObject({ kind: 'entity', root: true });
    expect(drawn('P-D-EN03').fields).toContainEqual({ name: 'Thing', type: '→ Thing' });
    expect(within(box('P-D-EN03')!).getByRole('list', { name: 'Fields of Loan' })).toHaveTextContent('Thing→ Thing');
    expect(new Set(erdScene(modelPane(), true).boxes.map((b) => b.kind))).toEqual(new Set(['domain', 'aggregate', 'entity']));
    expect(erdScene(modelPane(), true).lines).toHaveLength(map.lines.length);
    expect(lineOf('P-D-EN03|references|P-D-EN02')).toMatchObject({ dashed: true, ends: 'none-arrow', title: 'Loan references by ID Member (Loan.Member)', label: null });
    expect(lineOf('P-D-EN03|has_many|P-D-EN05')).toMatchObject({ dashed: false, ends: 'one-many', title: 'Loan has many Reminder' });
    // A dashed reference shows its fields while the pointer is on it.
    const ref = lineOf('P-D-EN03|references|P-D-EN02');
    hoverMapPoint({ x: (ref.from.x + ref.to.x) / 2, y: (ref.from.y + ref.to.y) / 2 });
    await waitFor(() => expect(lineOf('P-D-EN03|references|P-D-EN02')).toMatchObject({ hover: true, label: 'Loan.Member' }));
    // The product's focus fades nothing.
    expect(erdScene(modelPane(), true).boxes.filter((b) => b.strength < 1)).toEqual([]);
  };
  it('LA-V94-R02-T01 The map draws each aggregate as a boundary around its entities with their fields, has one and has many lines with crow\'s feet, and a dashed reference from an entity to another aggregate\'s root', proveLaV94R02T01);
  it('LA-V94-R01-T01 The map draws each domain as a region around its aggregates, and a reference to another domain\'s aggregate between regions', proveLaV94R02T01);

  const proveLaV94R03T01 = async () => {
    const map = modelMap();
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
      'P-D-EN05|references|P-D-EN02': 'none-arrow dashed' });
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
    expect(drawn('P-D-EN03').root).toBe(true);
    const fields = within(within(loan).getByRole('list', { name: 'Fields of Loan' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(fields).toEqual(['Loan IDwhole number', 'Thing→ Thing', 'Member→ Member', 'Due datedate']);
    expect(drawn('P-D-EN03').fields).toEqual([{ name: 'Loan ID', type: 'whole number' }, { name: 'Thing', type: '→ Thing' }, { name: 'Member', type: '→ Member' }, { name: 'Due date', type: 'date' }]);
    expect(drawn('P-D-A3')).toMatchObject({ pick: true, focus: true });
    await waitFor(() => expect(drawn('P-D-A1').strength).toBe(0.25));
    // A line to a faded box fades with it.
    expect(lineOf('P-D-EN03|references|P-D-EN01').strength).toBe(0.25);
    expect(lineOf('P-D-EN03|has_many|P-D-EN05')).toMatchObject({ ends: 'one-many', strength: 1 });
  };
  it('LA-V94-R03-T01 An aggregate\'s focus keeps its boundary, entities, fields and lines at full strength, its domain a trail, and fades the rest', proveLaV94R03T01);
  it('LA-V94-R01-T03 A large region is laid out to about the map\'s shape, its layers wrapped or its parts packed, whichever comes nearer', async () => {
    // A large domain's aggregates at their laid-out sizes and the references between them (Lathe's own Authoring, before it split by stage),
    // whose layers, wrapped, stand taller than wide.
    const SIZES: [string, number, number][] = [
      ['A1', 1142, 724], ['A2', 738, 461], ['A3', 738, 276], ['A4', 916, 674], ['A5', 488, 441], ['A6', 738, 706], ['A7', 488, 501], ['A8', 738, 548],
      ['A9', 738, 656], ['A10', 916, 734], ['A11', 916, 654], ['A12', 738, 276], ['A13', 738, 411], ['A14', 488, 441], ['A15', 238, 196],
    ];
    const REFS = [['A1', 'A4'], ['A2', 'A1'], ['A2', 'A4'], ['A3', 'A1'], ['A4', 'A1'], ['A6', 'A4'], ['A7', 'A6'], ['A8', 'A6'], ['A10', 'A4'], ['A10', 'A6'], ['A11', 'A4'], ['A13', 'A8'], ['A13', 'A10']];
    const box = (id: string, kind: 'domain' | 'aggregate', parent?: string) => ({ id, kind, title: id, root: false, fields: [], parent, empty: false });
    const map: ErdMap = {
      product: 'P',
      boxes: [box('D', 'domain'), ...SIZES.map(([id]) => box(id, 'aggregate', 'D'))],
      lines: REFS.map(([s, t]) => ({ id: s + t, source: s, target: t, relation: 'references' as const, sourceEnd: 'none' as const, targetEnd: 'arrow' as const, dashed: true, via: [] })) };
    const sizes = new Map(SIZES.map(([id, width, height]) => [id, { width, height }]));
    const shape = (n: { width?: number; height?: number }) => (n.width ?? 0) / (n.height ?? 1);
    const wrapped = await elkLayout(groupGraph(map, 'D', sizes, 'MULTI_EDGE'));
    expect(shape(wrapped)).toBeLessThan(1);
    // The region keeps the nearer layout: about 1.6:1, never taller than wide.
    const laid = await layoutRegion(map, 'D', sizes);
    expect(shape(laid)).toBeGreaterThan(1.3);
    expect(shape(laid)).toBeLessThan(2.1);
  });
  it('LA-V94-R01-T02 An aggregate\'s focus fades the aggregates it references, and its lines to them', proveLaV94R03T01);

  it('LA-V94-R04-T01 An entity\'s focus keeps its aggregate at full strength, picks the entity out and frames it', async () => {
    const i = index();
    const map = modelMap();
    const rects = await layoutErd(map);
    expect(framedRects(rects, map, erdFocus(i, 'P-D-EN04')!)).toEqual([rects.get('P-D-EN04')]);
    expect(erdStrength(map, erdFocus(i, 'P-D-EN04')!.scope, LOOK)('P-D-EN03')).toBe(1);

    await openApp('/P-D-EN04?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Return' });
    await boxesShown();
    expect(drawn('P-D-EN04')).toMatchObject({ pick: true, focus: true });
    expect(box('P-D-EN04')).toHaveAttribute('aria-label', 'Entity Return (picked out)');
    expect(drawn('P-D-EN03').pick).toBe(false);
    expect(within(modelPane()).getByRole('region', { name: 'Key' })).toHaveTextContent('Picked out');
  });

  it('LA-V94-R05-T01 Clicking a box goes to it, boxes show a hover state, and the key bar lists only the boxes and lines drawn', async () => {
    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const key = within(modelPane()).getByRole('region', { name: 'Key' });
    // The boxes, the pick and the fade, then the lines, each a sample and a word or two.
    expect(within(key).getAllByRole('listitem').map((li) => li.querySelector('.stage-key-words')?.textContent)).toEqual(['Domain', 'Aggregate', 'Entity', 'Root entity', 'Picked out', 'Faded', 'Has one (1:1)', 'Has many (1:n)', 'Reference by ID', 'Scroll pans']);
    expect(key.querySelector('.erd-key-line.rel-references.is-dashed')).not.toBeNull();
    expect(key.querySelector('.erd-key-line.rel-has_many:not(.is-dashed)')).not.toBeNull();
    // The stage's key bar along the bottom, a floating panel the open space leaves room for.
    expect(key).toHaveAttribute('data-floating', 'bottom');
    fireEvent.click(box('P-D-A3')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-A3?stage=erd');
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    // Enter on a focused box goes to it too.
    fireEvent.keyDown(box('P-D-EN05')!, { key: 'Enter' });
    expect(window.location.pathname).toBe('/P-D-EN05');
    // Hover (LA-PAT-APP-UX-R01): the box under the pointer is drawn with the shared hover ring.
    const reminder = drawn('P-D-EN03');
    hoverMapPoint({ x: reminder.map.x + 4, y: reminder.map.y + 4 });
    await waitFor(() => expect(drawn('P-D-EN03').hover).toBe(true));
    // Colors come from the domain model stage's tokens.
    const look = { ...PLAIN_LOOK, regionFill: '#fff', radius: 4 } as ErdLook;
    expect([boxEdge(look, 'entity'), boxEdge(look, 'aggregate'), boxEdge(look, 'domain')]).toEqual([look.domainModelEdge, look.domainModelEdge, look.muted]);
  });

  it('LA-V94-R06-T01 A domain\'s focus fades the other domains\' regions, out of focus and out of the keyboard order, the fade easing on the shared motion', async () => {
    const map = modelMap();
    const strength = erdStrength(map, 'P-D', LOOK);
    expect(map.boxes.filter((b) => strength(b.id) < 1).map((b) => b.id)).toEqual(['P-E', 'P-E-A1', 'P-E-EN01']);
    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    expect(box('P-E-A1')).toHaveAttribute('aria-hidden', 'true');
    expect(box('P-E-A1')).not.toHaveAttribute('tabindex');
    expect(box('P-D-A1')).toHaveAttribute('tabindex', '0');
    expect(box('P-D-A1')).not.toHaveAttribute('aria-hidden');
  });

  it('LA-V94-R06-T02 The frame fits what it frames inside the margin at any canvas size and inside the open space, never zoomed in past 1', async () => {
    const rects = await layoutErd(modelMap());
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

  let runs = 0;
  const proveOneMap = async () => {
    runs++;
    const map = modelMap();
    // One layout for what the map reads: asked again, the same one; a new answer of the ERD read that changes nothing it
    // reads (new data elsewhere) reads it too, at once.
    const rects = await erdLayout(map);
    expect(await erdLayout(map)).toBe(rects);
    expect(readyErdLayout(map)).toBe(rects);
    expect(readyErdLayout(modelMap())).toBe(rects);
    // An answer that changes what it reads (a box's title) is laid out anew, once; the map's size decides whether it draws only what is in view.
    const fresh = modelMap();
    const again = { ...fresh, boxes: fresh.boxes.map((b) => (b.id === 'P-D-EN05' ? { ...b, title: `${b.title} retitled ${runs}` } : b)) };
    expect(readyErdLayout(again)).toBeUndefined();
    expect((await erdLayout(again)).get('P-D-EN05')).toBeDefined();
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
    await waitFor(() => expect(drawn('P-D-EN05').pick).toBe(true));
    expect(places()).toEqual(before);
  };
  it('LA-V94-R08-T01 The map is laid out once: focusing two records moves no box and changes no size, and the layout is read again, never redone', proveOneMap);
  it('LA-PAT-APP-UX-R19-T02 The ERD map is laid out once: focusing two records moves no box, and the layout is read again for the same data', proveOneMap);

  it('LA-EXP-DS11-T01 The map draws exactly one line per relationship link and one per entity and aggregate it references', () => {
    const i = index();
    const map = modelMap();
    const entities = new Set(map.boxes.filter((b) => b.kind === 'entity').map((b) => b.id));
    const links = [...i.outgoing.values()].flat().filter((l) => ['has_one', 'has_many'].includes(l.relation) && entities.has(l.source));
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
    render(<StageKey entries={erdKeyEntries(map, erdFocus(i, 'P')!, i.meta.relations)} />);
    expect(screen.getByText('Reference by ID').closest('li')).toHaveAttribute('title', "A field holds the other aggregate's ID; the line points at its root.");
  });
});
