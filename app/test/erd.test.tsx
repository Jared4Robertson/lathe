import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aggregateErd, domainErd, endPath, erdFor, lineGeometry, lineOffsets, modelScope } from '../src/erd/erd';
import { erdGraph, layoutErd } from '../src/erd/layout';
import { ErdKey, FIT_MARGIN, fitRects, lineWords } from '../src/erd/ErdView';
import { openApp } from './helpers';
import { modelIndex, modelWorkspace } from './fixtures/model';

// The ERD stage: the entity-relationship diagram of a domain (its aggregates as boundaries around their
// entities) or of an aggregate (with the aggregates it references, or that reference it, faded around it).
// It works on every focus (LA-PAT-APP-UX-R17): any other record draws its domain's (or for a Shared
// record its product's) ERD, its nearest entity or aggregate highlighted.

const served = () => ({ data: modelWorkspace() });
const index = () => modelIndex();
const modelPane = () => screen.getByRole('region', { name: 'ERD stage' });
const box = (id: string) => modelPane().querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const boxesShown = () => waitFor(() => expect(modelPane().querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const ends = (erd: { lines: { id: string; sourceEnd: string; targetEnd: string; dashed: boolean }[] }) =>
  Object.fromEntries(erd.lines.map((l) => [l.id, `${l.sourceEnd}-${l.targetEnd}${l.dashed ? ' dashed' : ''}`]));

describe('the ERD stage', () => {
  const proveErdOnEveryFocus = async () => {
    const i = index();
    // A domain, an aggregate and an entity draw their own diagram, as before.
    expect(modelScope(i, 'P-D')).toEqual({ level: 'domain', scope: 'P-D', highlight: null });
    expect(modelScope(i, 'P-D-A3')).toEqual({ level: 'aggregate', scope: 'P-D-A3', highlight: null });
    expect(modelScope(i, 'P-D-EN03')).toEqual({ level: 'aggregate', scope: 'P-D-A3', highlight: 'P-D-EN03' });
    // Any other record: its domain's ERD, its nearest entity or aggregate highlighted when it has one.
    expect(modelScope(i, 'P-D-UC01')).toEqual({ level: 'domain', scope: 'P-D', highlight: null });
    expect(modelScope(i, 'P-D-CMD01')).toEqual({ level: 'domain', scope: 'P-D', highlight: 'P-D-A3' });
    expect(modelScope(i, 'P-D-CMD01-H')).toEqual({ level: 'domain', scope: 'P-D', highlight: 'P-D-A3' });
    expect(modelScope(i, 'P-D-EV02')).toEqual({ level: 'domain', scope: 'P-D', highlight: 'P-D-A3' });
    // A group: its owner's. A Shared record and a product: the product's ERD.
    expect(modelScope(i, 'P-D-A3/invariant')).toEqual({ level: 'aggregate', scope: 'P-D-A3', highlight: null });
    expect(modelScope(i, 'P-D/use-cases')).toEqual({ level: 'domain', scope: 'P-D', highlight: null });
    expect(modelScope(i, 'P-VO01')).toEqual({ level: 'product', scope: 'P', highlight: null });
    expect(modelScope(i, 'P')).toEqual({ level: 'product', scope: 'P', highlight: null });
    for (const id of ['P', 'P-D-UC01', 'P-VO01', 'P-D-UC01-FL01', 'P-D-CMD01', 'P-D-EV01', 'P-D-PO01', 'P-D-RM01', 'P-D-QRY01', 'P-D-SP01']) {
      expect(erdFor(i, id)!.boxes.length, id).toBeGreaterThan(0);
    }
    expect(erdFor(i, 'P-D-CMD01')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-A3']);
    // The product's ERD draws every domain's aggregates as its own, none as another domain's.
    expect(erdFor(i, 'P')!.boxes.filter((b) => b.kind === 'aggregate' && b.boundary).map((b) => b.id)).toEqual(expect.arrayContaining(['P-D-A3', 'P-E-A1']));
    expect(erdFor(i, 'P')!.boxes.some((b) => b.tone === 'other')).toBe(false);

    // The switch always offers the ERD: on a use case it draws the domain's diagram.
    await openApp('/P-D-UC01?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    expect(stageButton('ERD')).not.toHaveAttribute('aria-disabled');
    await boxesShown();
    expect(box('P-D-A3')).not.toBeNull();

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
  it('LA-V96-R18-T01 Every focus has an ERD stage: a domain\'s, an aggregate\'s or an entity\'s own diagram, otherwise its domain\'s or product\'s with its nearest entity or aggregate highlighted', proveErdOnEveryFocus);
  it('LA-PAT-APP-UX-R17-T03 The ERD stage works on every focus, the switch never disabled', proveErdOnEveryFocus);

  const proveLaV94R02T01 = async () => {
    const erd = domainErd(index(), 'P-D');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    // Entities and aggregates only: no command, event, policy, specification, read model or query.
    expect([...new Set(erd.boxes.map((b) => b.kind))].sort()).toEqual(['aggregate', 'entity']);
    expect(erd.boxes.filter((b) => b.kind === 'aggregate' && b.boundary).map((b) => b.id)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4']);
    expect(erd.boxes.filter((b) => b.parent === 'P-D-A3').map((b) => [b.id, b.root])).toEqual([['P-D-EN03', true], ['P-D-EN04', false], ['P-D-EN05', false]]);
    expect(byId.get('P-D-EN03')!.fields).toEqual([{ field: 'Loan ID', kind: 'whole number' }, { field: 'Thing', kind: '→ Thing' }, { field: 'Member', kind: '→ Member' }, { field: 'Due date', kind: 'date' }]);
    expect(byId.get('P-D-EN01')!.fields).toContainEqual({ field: 'Name', kind: 'Name' });
    // Another domain's aggregate: a closed box, gray and faded, labeled with its domain.
    expect(byId.get('P-E-A1')).toMatchObject({ kind: 'aggregate', boundary: false, tone: 'other', owner: 'Accounts', context: true });
    // Has one and has many between entities, with crow's feet; a dashed reference from the field's entity to the other aggregate's root.
    expect(ends(erd)).toEqual({
      'P-D-EN03|has_one|P-D-EN04': 'one-one',
      'P-D-EN03|has_many|P-D-EN05': 'one-many',
      'P-D-EN02|references|P-E-A1': 'none-arrow dashed',
      'P-D-EN03|references|P-D-EN01': 'none-arrow dashed',
      'P-D-EN03|references|P-D-EN02': 'none-arrow dashed',
      'P-D-EN05|references|P-D-EN02': 'none-arrow dashed',
      'P-D-EN06|references|P-D-EN01': 'none-arrow dashed',
    });
    expect(erd.lines.find((l) => l.id === 'P-D-EN02|references|P-E-A1')).toMatchObject({ via: ['Member.Account'], context: true });
    // The top level lays out the boundaries along the references between them.
    const sizes = new Map<string, { width: number; height: number }>();
    expect(erdGraph(erd, sizes).edges).toEqual(expect.arrayContaining([expect.objectContaining({ sources: ['P-D-A3'], targets: ['P-D-A2'] })]));
    expect(erdGraph(erd, sizes).children!.map((c) => c.id)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4', 'P-E-A1']);
    // Each entity sits inside its boundary, below its head.
    const rects = await layoutErd(erd);
    for (const b of erd.boxes.filter((x) => x.parent)) {
      const r = rects.get(b.id)!;
      const at = rects.get(b.parent!)!;
      expect(r.x).toBeGreaterThanOrEqual(at.x);
      expect(r.y).toBeGreaterThan(at.y + 30);
      expect(r.x + r.width).toBeLessThanOrEqual(at.x + at.width);
      expect(r.y + r.height).toBeLessThanOrEqual(at.y + at.height);
    }

    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    expect(box('P-D-A3')!.querySelector('.erd-box')).toHaveClass('erd-aggregate', 'tone-current');
    expect(box('P-D-A3')).toHaveAttribute('aria-label', 'Aggregate Loan');
    expect(box('P-D-EN03')).toHaveAttribute('aria-label', 'Entity Loan, root');
    expect(within(box('P-D-EN03')!).getByRole('list', { name: 'Fields of Loan' })).toHaveTextContent('Thing→ Thing');
    expect(box('P-E-A1')).toHaveClass('is-context');
    expect(box('P-E-A1')).toHaveTextContent('Aggregate · Accounts');
    expect(modelPane().querySelector('.erd-command, .erd-event, .erd-policy')).toBeNull();
    await waitFor(() => expect(modelPane().querySelectorAll('.erd-line')).toHaveLength(erd.lines.length));
    expect(modelPane().querySelector('[data-line="P-D-EN03|references|P-D-EN02"]')).toHaveClass('is-dashed', 'has-hover-label');
    expect(modelPane().querySelector('[data-line="P-D-EN03|references|P-D-EN02"] title')).toHaveTextContent('Loan references by ID Member (Loan.Member)');
    expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"] title')).toHaveTextContent('Loan has many Reminder');
  };
  it('LA-V94-R02-T01 A domain\'s ERD draws each aggregate as a boundary around its entities with their fields, has one and has many lines with crow\'s feet, and a dashed reference from an entity to another aggregate\'s root', proveLaV94R02T01);
  it('LA-V94-R01-T01 A domain\'s ERD draws a referenced aggregate of another domain as a closed box, gray and faded, labeled with its domain', proveLaV94R02T01);

  const proveLaV94R03T01 = async () => {
    const erd = aggregateErd(index(), 'P-D-A3');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect(byId.get('P-D-A3')).toMatchObject({ boundary: true, context: false });
    expect(byId.get('P-D-EN03')).toMatchObject({ root: true, parent: 'P-D-A3' });
    // The aggregates it references: closed boxes, faded.
    expect(byId.get('P-D-A1')).toMatchObject({ kind: 'aggregate', boundary: false, context: true, tone: 'current' });
    expect(erd.boxes.map((b) => b.id)).toEqual(['P-D-A3', 'P-D-EN03', 'P-D-EN04', 'P-D-EN05', 'P-D-A1', 'P-D-A2']);
    expect(ends(erd)).toEqual({
      'P-D-EN03|has_one|P-D-EN04': 'one-one',
      'P-D-EN03|has_many|P-D-EN05': 'one-many',
      'P-D-EN03|references|P-D-A1': 'none-arrow dashed',
      'P-D-EN03|references|P-D-A2': 'none-arrow dashed',
      'P-D-EN05|references|P-D-A2': 'none-arrow dashed',
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
    const line = erd.lines[0];
    const offsets = lineOffsets([{ ...line, id: 'a' }, { ...line, id: 'b' }]);
    expect(offsets.get('a')).not.toBe(offsets.get('b'));

    await openApp('/P-D-A3?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await boxesShown();
    const loan = box('P-D-EN03')!;
    expect(within(loan).getByText('root')).toHaveClass('erd-root');
    const fields = within(within(loan).getByRole('list', { name: 'Fields of Loan' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(fields).toEqual(['Loan IDwhole number', 'Thing→ Thing', 'Member→ Member', 'Due datedate']);
    expect(box('P-D-A1')).toHaveClass('is-context');
    await waitFor(() => expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"]')).toHaveAttribute('data-ends', 'one-many'));
  };
  it('LA-V94-R03-T01 An aggregate\'s ERD shows each entity\'s title, root mark and fields with their types, has one and has many lines with crow\'s feet, and its references to the aggregates around it', proveLaV94R03T01);
  it('LA-V94-R01-T02 An aggregate\'s ERD draws the aggregates it references as closed boxes, faded, with a dashed line from each referring entity', proveLaV94R03T01);

  it('LA-V94-R04-T01 An entity page draws its aggregate\'s ERD with the entity highlighted', async () => {
    expect(erdFor(index(), 'P-D-EN04')).toMatchObject({ level: 'aggregate', scope: 'P-D-A3' });
    expect(erdFor(index(), 'P-D-EN04')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-EN04']);
    // A record that is no entity draws its domain's ERD instead, its aggregate highlighted.
    expect(erdFor(index(), 'P-D-CMD02')).toMatchObject({ level: 'domain', scope: 'P-D' });

    await openApp('/P-D-EN04?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Return' });
    await boxesShown();
    expect(box('P-D-EN04')!.querySelector('.erd-box')).toHaveClass('is-highlight', 'is-focus');
    expect(box('P-D-EN04')).toHaveAttribute('aria-label', 'Entity Return (this entity)');
    expect(box('P-D-EN03')!.querySelector('.erd-box')).not.toHaveClass('is-highlight');
    expect(within(modelPane()).getByRole('group', { name: 'Key' })).toHaveTextContent('This entity');
  });

  it('LA-V94-R05-T01 Clicking a box goes to it, boxes show a hover state, and a key under the diagram lists only the boxes and lines drawn', async () => {
    await openApp('/P-D?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const key = within(modelPane()).getByRole('group', { name: 'Key' });
    const boxes = within(key).getByRole('list', { name: 'Boxes' });
    expect(within(boxes).getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual(['Entity', 'root Root entity', 'Aggregate boundary', 'Other domain']);
    const lines = within(key).getByRole('list', { name: 'Lines' });
    expect(within(lines).getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual(['Has one (1:1)', 'Has many (1:n)', 'Reference by ID']);
    expect(lines.querySelector('.erd-key-line.rel-references.is-dashed')).not.toBeNull();
    expect(lines.querySelector('.erd-key-line.rel-has_many:not(.is-dashed)')).not.toBeNull();
    // Under the diagram, keeping one height.
    expect(modelPane().querySelector('.erd-canvas')!.compareDocumentPosition(key.closest('.erd-key')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(CSS).toMatch(/\.erd-key\s*\{[^}]*block-size:\s*var\(--erd-key-height\)/);
    fireEvent.click(box('P-D-A3')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-A3?stage=erd');
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await waitFor(() => expect(box('P-D-EN03')).not.toBeNull());
    // Enter on a focused box goes to it too.
    fireEvent.keyDown(box('P-D-EN05')!, { key: 'Enter' });
    expect(window.location.pathname).toBe('/P-D-EN05');
    // Hover (LA-PAT-APP-UX-R01) on the shared ring and speed, off under reduced motion.
    expect(CSS).toMatch(/\.erd-box:not\(\.is-focus\):hover\s*\{[^}]*var\(--hover-ring\)/);
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*transition:\s*box-shadow var\(--hover-speed\)/);
    // Colors come from the domain model stage's tokens; another domain is gray.
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*var\(--g-domain-model\)/);
    expect(CSS).toMatch(/\.erd-box\.erd-aggregate\s*\{[^}]*var\(--g-domain-model-bg\)/);
    expect(CSS).toMatch(/\.erd-box\.tone-other\s*\{[^}]*var\(--muted\)[^}]*var\(--paper\)/);
  });

  it('LA-V94-R06-T01 An aggregate\'s ERD fades the aggregates it references and those that reference it; a domain\'s ERD fades other domains\' aggregates', () => {
    const thing = aggregateErd(index(), 'P-D-A1');
    expect(thing.boxes.filter((b) => b.context).map((b) => b.id)).toEqual(['P-D-A3', 'P-D-A4']);
    expect(ends(thing)).toEqual({ 'P-D-A3|references|P-D-EN01': 'none-arrow dashed', 'P-D-A4|references|P-D-EN01': 'none-arrow dashed' });
    expect(thing.lines.map((l) => [l.via, l.context])).toEqual([[['Loan.Thing'], true], [['Shelf.Thing'], true]]);
    // From the other side of a domain boundary: the referring aggregate is gray, labeled with its domain.
    expect(aggregateErd(index(), 'P-E-A1').boxes.find((b) => b.id === 'P-D-A2')).toMatchObject({ tone: 'other', owner: 'Domain', context: true });
    expect(domainErd(index(), 'P-D').boxes.filter((b) => b.context).map((b) => b.id)).toEqual(['P-E-A1']);
  });

  it('LA-V94-R06-T02 The opening frame fits every box, faded ones included, inside the margin at any canvas size, and the faded boxes are out of focus', async () => {
    const rects = await layoutErd(aggregateErd(index(), 'P-D-A3'), 1.6);
    for (const [width, height] of [[1200, 700], [600, 500], [320, 260]]) {
      const v = fitRects(rects, width, height);
      for (const r of rects.values()) {
        expect(v.x + r.x * v.zoom).toBeGreaterThanOrEqual(FIT_MARGIN.left - 0.5);
        expect(v.y + r.y * v.zoom).toBeGreaterThanOrEqual(FIT_MARGIN.top - 0.5);
        expect(v.x + (r.x + r.width) * v.zoom).toBeLessThanOrEqual(width - FIT_MARGIN.right + 0.5);
        expect(v.y + (r.y + r.height) * v.zoom).toBeLessThanOrEqual(height - FIT_MARGIN.bottom + 0.5);
      }
      expect(v.zoom).toBeLessThanOrEqual(1);
    }
    // In the open space the host's panels leave: the margin grows by their insets, so every box sits between them.
    const open = { left: FIT_MARGIN.left + 400, right: FIT_MARGIN.right + 300, top: FIT_MARGIN.top + 80, bottom: FIT_MARGIN.bottom };
    const v = fitRects(rects, 1400, 900, open);
    for (const r of rects.values()) {
      expect(v.x + r.x * v.zoom).toBeGreaterThanOrEqual(open.left - 0.5);
      expect(v.x + (r.x + r.width) * v.zoom).toBeLessThanOrEqual(1400 - open.right + 0.5);
      expect(v.y + r.y * v.zoom).toBeGreaterThanOrEqual(open.top - 0.5);
    }
    await openApp('/P-D-A3?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await boxesShown();
    expect(box('P-D-A1')).toHaveAttribute('aria-hidden', 'true');
    expect(within(modelPane()).getByRole('group', { name: 'Key' })).toHaveTextContent('Faded: around it');
  });

  it('LA-EXP-DS11-T01 An ERD draws exactly one line per relationship link and one per entity and aggregate it references', () => {
    const i = index();
    const erd = domainErd(i, 'P-D');
    const entities = new Set(erd.boxes.filter((b) => b.kind === 'entity').map((b) => b.id));
    const links = i.workspace.links.filter((l) => ['has_one', 'has_many'].includes(l.relation) && entities.has(l.source));
    expect(links.length).toBe(2);
    for (const l of links) expect(erd.lines.filter((x) => x.source === l.source && x.target === l.target && x.relation === l.relation)).toHaveLength(1);
    // Loan's two references to Member come from two entities: two lines; its Thing one line.
    expect(erd.lines.filter((l) => l.relation === 'references')).toHaveLength(5);
    const ids = erd.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A line's words read from its source, the reference's fields its hover label.
    const ref = erd.lines.find((l) => l.id === 'P-D-EN05|references|P-D-EN02')!;
    const titles = new Map(erd.boxes.map((b) => [b.id, b.title]));
    expect(lineWords(ref, 'References by ID', titles)).toEqual({ label: 'references by ID', title: 'Reminder references by ID Member (Reminder.Member)', hover: 'Reminder.Member' });
    render(<ErdKey erd={erd} relations={i.workspace.relations} />);
    expect(within(screen.getByRole('group', { name: 'Key' })).getByText('Reference by ID').closest('li')).toHaveAttribute('title', "A field holds the other aggregate's ID; the line points at its root.");
  });
});
