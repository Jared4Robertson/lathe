import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aggregateErd, domainErd, endPath, erdFor, lineGeometry, lineOffsets } from '../src/erd/erd';
import { erdGraph, layoutErd } from '../src/erd/layout';
import { ErdKey, FIT_MARGIN, fitRects, lineWords } from '../src/erd/ErdView';
import { viewsOffered, viewsShown } from '../src/views/address';
import { openApp } from './helpers';
import { modelIndex, modelWorkspace } from './fixtures/model';

// The ERD view: the entity-relationship diagram of a domain (its aggregates as boundaries around their
// entities) or of an aggregate (with the aggregates it references, or that reference it, faded around it);
// offered on domain, aggregate and entity pages.

const served = () => ({ data: modelWorkspace() });
const index = () => modelIndex();
const modelPane = () => screen.getByRole('region', { name: 'ERD pane' });
const box = (id: string) => modelPane().querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const boxesShown = () => waitFor(() => expect(modelPane().querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
const viewToggle = (name: string) => within(screen.getByRole('group', { name: 'View' })).queryByRole('button', { name });
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const ends = (erd: { lines: { id: string; sourceEnd: string; targetEnd: string; dashed: boolean }[] }) =>
  Object.fromEntries(erd.lines.map((l) => [l.id, `${l.sourceEnd}-${l.targetEnd}${l.dashed ? ' dashed' : ''}`]));

describe('the ERD view', () => {
  const proveLaExpSp02T = async () => {
    const i = index();
    // The Trace view is offered by what is under a page, not by its kind (LA-V98-R01): left out here.
    const erdAmong = (id: string) => viewsOffered(i, id).filter((v) => v !== 'trace');
    for (const id of ['P-D', 'P-D-A3', 'P-D-EN03']) expect(erdAmong(id)).toEqual(['wiki', 'graph', 'erd']);
    for (const id of ['P', 'P-D-UC01', 'P-VO01', 'P-D-UC01-FL01', 'P-D-CMD01', 'P-D-EV01', 'P-D-PO01', 'P-D-RM01', 'P-D-QRY01', 'P-D-SP01']) {
      expect(erdAmong(id)).toEqual(['wiki', 'graph']);
    }
    expect(viewsShown(['graph', 'erd'], ['wiki', 'graph'])).toEqual(['graph']);
    expect(viewsShown(['erd'], ['wiki', 'graph'])).toEqual(['wiki']);

    // Elsewhere there is no ERD toggle to press, and a link naming it shows the rest.
    await openApp('/P-D-UC01?view=graph,erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(viewToggle('ERD')).toBeNull();
    expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Graph pane']);

    // On an aggregate: ERD opens with its toggle or Ctrl+4, in the order Wiki, Graph, ERD.
    await openApp('/P-D-A3?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(viewToggle('ERD')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: '4', code: 'Digit4', ctrlKey: true });
    expect(window.location.search).toBe('?stage=erd');
    expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Wiki pane', 'Graph pane', 'ERD pane']);
    await boxesShown();
    // Alt+E turns it off again (off a Mac).
    fireEvent.keyDown(document.body, { key: 'e', code: 'KeyE', altKey: true });
    expect(window.location.search).toBe('?stage=graph');
  };
  it('LA-EXP-SP02-T The ERD view is offered only on domain, aggregate and entity pages, opens after Wiki and Graph, and an address naming it elsewhere drops it', proveLaExpSp02T);
  it('LA-V96-R18-T01 The ERD view is offered only on domain, aggregate and entity pages, opens after Wiki and Graph, and an address naming it elsewhere drops it', proveLaExpSp02T);

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
    for (const id of ['P-D-CMD02', 'P-D-EV02', 'P-D-PO01', 'P-D-RM01', 'P-D-SP01', 'P-D-UC01']) expect(erdFor(index(), id)).toBeNull();

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

  it('LA-V96-R09-T01 Above a graph, ERD or trace pane the page title keeps one fixed height, so the canvas never moves when the focus changes; in the wiki pane it wraps', async () => {
    await openApp('/P-D-A3?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const title = () => screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('.pane-title')!;
    expect(title()).toHaveClass('is-fixed');
    expect(title()).toHaveAttribute('title', 'Loan');
    expect(CSS).toMatch(/\.pane-title\.is-fixed\s*\{[^}]*height:\s*var\(--pane-title-height\)/);
    expect(CSS).toMatch(/--pane-title-height:\s*\d+px/);
    expect(CSS).toMatch(/\.pane-title\.is-fixed :is\(\.eyebrow, h1, \.record-id\)\s*\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/);
    await openApp('/P-D-EN03?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(title()).toHaveClass('is-fixed');
    await openApp('/P-D-UC01?stage=trace', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(title()).toHaveClass('is-fixed');
    await openApp('/P-D-A3?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(title()).not.toHaveClass('is-fixed');
  });

  const proveLaV61R02T03 = async () => {
    await openApp('/P-D-A3?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const first = screen.getByRole('separator', { name: 'Resize the wiki and graph panes' });
    const second = screen.getByRole('separator', { name: 'Resize the graph and ERD panes' });
    fireEvent.keyDown(second, { key: 'ArrowRight' });
    expect(second).toHaveAttribute('aria-valuenow', '55');
    expect(first).toHaveAttribute('aria-valuenow', '48');
    const views = document.querySelector<HTMLElement>('.focus-views')!;
    expect(views.style.gridTemplateColumns).toBe('minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 110fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 90fr)');
    fireEvent.doubleClick(second);
    expect(views.style.gridTemplateColumns).toBe('minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr)');
  };
  it('LA-V61-R02-T03 With three panes open each gap is its own handle, resizing only the two panes beside it', proveLaV61R02T03);
  it('LA-V61-R03-T04 With three panes open each gap is its own handle, resizing only the two panes beside it', proveLaV61R02T03);
});
