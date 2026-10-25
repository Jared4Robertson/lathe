import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { indexWorkspace } from '../src/specs/data';
import { aggregateErd, domainErd, endPath, erdFor, ENTITY_RELATIONS, lineGeometry } from '../src/model/erd';
import { viewsOffered, viewsShown } from '../src/views/address';
import { openApp } from './helpers';
import { entityWorkspace } from './fixtures/entities';

// The Model view: an ERD of a domain at aggregate level, and of each aggregate's entities, offered
// only on domain, aggregate and entity pages.

const served = () => ({ workspace: entityWorkspace() });
const index = () => indexWorkspace(entityWorkspace());
const modelPane = () => screen.getByRole('region', { name: 'Model pane' });
const box = (id: string) => modelPane().querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const boxesShown = () => waitFor(() => expect(modelPane().querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
const viewToggle = (name: string) => within(screen.getByRole('group', { name: 'View' })).queryByRole('button', { name });
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('the Model view', () => {
  it('LA-EXP-T121 Model is offered only on domain, aggregate and entity pages, opens as a third pane after Wiki and Graph, and an address naming it elsewhere drops it', async () => {
    const i = index();
    expect(viewsOffered(i, 'P-D')).toEqual(['wiki', 'graph', 'model']);
    expect(viewsOffered(i, 'P-D-A3')).toEqual(['wiki', 'graph', 'model']);
    expect(viewsOffered(i, 'P-D-EN03')).toEqual(['wiki', 'graph', 'model']);
    expect(viewsOffered(i, 'P-D-UC01')).toEqual(['wiki', 'graph']);
    expect(viewsOffered(i, 'P')).toEqual(['wiki', 'graph']);
    expect(viewsShown(['graph', 'model'], ['wiki', 'graph'])).toEqual(['graph']);
    expect(viewsShown(['model'], ['wiki', 'graph'])).toEqual(['wiki']);

    // Elsewhere there is no Model toggle, and a link naming it shows the rest.
    await openApp('/P-D-UC01?view=graph,model', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(viewToggle('Model')).toBeNull();
    expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Graph pane']);

    // On an aggregate: Model opens with its toggle or Ctrl+4, in the order Wiki, Graph, Model.
    await openApp('/P-D-A3?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(viewToggle('Model')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(document.body, { key: '4', code: 'Digit4', ctrlKey: true });
    expect(window.location.search).toBe('?view=wiki,graph,model');
    expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Wiki pane', 'Graph pane', 'Model pane']);
    expect(within(document.querySelector<HTMLElement>('.page-bar')!).getByRole('group', { name: 'View' })).toBeInTheDocument();
    await boxesShown();
    // Alt+M turns it off again (off a Mac).
    fireEvent.keyDown(document.body, { key: 'm', code: 'KeyM', altKey: true });
    expect(window.location.search).toBe('?view=wiki,graph');
  });

  it('LA-EXP-T122 A domain\'s ERD draws each aggregate with its root and entity count, one many-to-one line per aggregate pair and direction, relates_to dashed as a fallback, and another domain\'s aggregates gray with their owner', async () => {
    const erd = domainErd(index(), 'P-D');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect([...byId.keys()].sort()).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4', 'P-E-A1']);
    expect(byId.get('P-D-A3')).toMatchObject({ title: 'Loan', rootTitle: 'Loan', entities: 3, tone: 'current', owner: null });
    expect(byId.get('P-E-A1')).toMatchObject({ tone: 'other', owner: '(Accounts)', foreign: true });
    const lines = erd.lines.map((l) => [l.source, l.target, l.sourceEnd, l.targetEnd, l.dashed, l.links.length]);
    expect(lines).toEqual(expect.arrayContaining([
      ['P-D-A3', 'P-D-A1', 'many', 'one', false, 1],
      ['P-D-A3', 'P-D-A2', 'many', 'one', false, 2],
      ['P-D-A2', 'P-E-A1', 'many', 'one', false, 1],
      ['P-D-A4', 'P-D-A1', 'many', 'one', true, 1],
    ]));
    expect(lines).toHaveLength(4);

    await openApp('/P-D?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    expect(box('P-D-A3')!.querySelector('.erd-box')).toHaveTextContent('LoanRoot: Loan · 3 entities');
    expect(box('P-E-A1')!.querySelector('.erd-box')).toHaveClass('tone-other');
    expect(box('P-E-A1')).toHaveTextContent('(Accounts)');
    await waitFor(() => expect(modelPane().querySelectorAll('.erd-line')).toHaveLength(4));
    expect(modelPane().querySelector('.erd-line[data-line="P-D-A4|relates_to|P-D-A1"]')).toHaveClass('is-dashed');
  });

  it('LA-EXP-T123 An aggregate\'s ERD shows each entity\'s title, root mark and fields with their kind of value, crow\'s-foot ends by cardinality, and entities from elsewhere labeled with their owner', async () => {
    const erd = aggregateErd(index(), 'P-D-A3');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect(byId.get('P-D-EN03')).toMatchObject({ root: true, fields: [{ field: 'Loan ID', kind: 'Whole number' }, { field: 'Borrowed at', kind: 'Date and time' }, { field: 'Due date', kind: 'Date' }] });
    expect(byId.get('P-D-EN01')).toMatchObject({ owner: '(Thing)', tone: 'current', foreign: true });
    expect(aggregateErd(index(), 'P-D-A2').boxes.find((b) => b.id === 'P-E-EN01')).toMatchObject({ owner: '(Accounts · Account)', tone: 'other' });
    const ends = Object.fromEntries(erd.lines.map((l) => [l.id, `${l.sourceEnd}-${l.targetEnd}`]));
    expect(ends).toMatchObject({ 'P-D-EN03|has_one|P-D-EN04': 'one-one', 'P-D-EN03|has_many|P-D-EN05': 'one-many', 'P-D-EN03|refers_to|P-D-EN01': 'many-one' });
    // A crow's foot has three prongs and a bar; one is two bars.
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'many').match(/M/g)).toHaveLength(4);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'one').match(/M/g)).toHaveLength(2);
    // Lines run from box edge to box edge.
    const g = lineGeometry({ x: 0, y: 0, width: 100, height: 50 }, { x: 300, y: 0, width: 100, height: 50 }, ['many', 'one']);
    expect(g.from).toEqual({ x: 100, y: 25 });
    expect(g.to).toEqual({ x: 300, y: 25 });

    await openApp('/P-D-A3?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await boxesShown();
    const loan = box('P-D-EN03')!;
    expect(within(loan).getByText('root')).toHaveClass('erd-root');
    const fields = within(within(loan).getByRole('list', { name: 'Fields of Loan' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(fields).toEqual(['Loan IDWhole number', 'Borrowed atDate and time', 'Due dateDate']);
    expect(box('P-D-EN02')).toHaveTextContent('(Member)');
    await waitFor(() => expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"]')).toHaveAttribute('data-ends', 'one-many'));
  });

  it('LA-EXP-T124 An entity page draws its aggregate\'s ERD with the entity highlighted', async () => {
    expect(erdFor(index(), 'P-D-EN04')).toMatchObject({ level: 'aggregate', scope: 'P-D-A3' });
    expect(erdFor(index(), 'P-D-EN04')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-EN04']);
    await openApp('/P-D-EN04?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Return' });
    await boxesShown();
    expect(box('P-D-EN04')!.querySelector('.erd-box')).toHaveClass('is-highlight', 'is-focus');
    expect(box('P-D-EN03')!.querySelector('.erd-box')).not.toHaveClass('is-highlight');
    expect(within(modelPane()).getByRole('group', { name: 'Key' })).toHaveTextContent('This entity');
  });

  it('LA-PLT-T49 Clicking a box goes to it, boxes show a hover state, and a key under the diagram explains the colors with emoji squares and the line ends', async () => {
    await openApp('/P-D?view=wiki,model', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const key = within(modelPane()).getByRole('group', { name: 'Key' });
    expect(key).toHaveTextContent('🟦The current domain');
    expect(key).toHaveTextContent('⬜Another domain');
    expect(key).toHaveTextContent('many to one');
    expect(key).toHaveTextContent('Related aggregate');
    // Under the diagram.
    expect(modelPane().querySelector('.model-canvas')!.compareDocumentPosition(key.closest('.erd-key')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(box('P-D-A3')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-A3?view=wiki,model');
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await waitFor(() => expect(box('P-D-EN03')).not.toBeNull());
    // Enter on a focused box goes to it too.
    fireEvent.keyDown(box('P-D-EN05')!, { key: 'Enter' });
    expect(window.location.pathname).toBe('/P-D-EN05');
    // Hover (LA-PAT-APP-UX-R01) on the shared ring and speed, off under reduced motion.
    expect(CSS).toMatch(/\.erd-box:not\(\.is-focus\):hover\s*\{[^}]*var\(--hover-ring\)/);
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*transition:\s*box-shadow var\(--hover-speed\)/);
    // Colors come from tokens: blue for the current domain, gray for another.
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*var\(--steel\)[^}]*var\(--steel-bg\)/);
    expect(CSS).toMatch(/\.erd-box\.tone-other\s*\{[^}]*var\(--muted\)[^}]*var\(--paper\)/);
  });

  it('LA-EXP-T125 An ERD draws exactly one line per relationship link: each aggregate\'s for the links its entities hold, the domain\'s for each aggregate pair and direction they join', () => {
    const i = index();
    const entityLinks = entityWorkspace().links.filter((l) => (ENTITY_RELATIONS as readonly string[]).includes(l.relation));
    const aggregates = ['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4'];
    const drawn = aggregates.flatMap((a) => aggregateErd(i, a).lines.filter((l) => !l.context));
    // Every link of the domain's entities appears in focus in exactly one aggregate's ERD, once (elsewhere it may be the faded ring).
    const domainLinks = entityLinks.filter((l) => i.byId.get(l.source)?.domain === 'P-D');
    expect(drawn.map((l) => `${l.source}|${l.relation}|${l.target}`).sort()).toEqual(domainLinks.map((l) => `${l.source}|${l.relation}|${l.target}`).sort());
    for (const l of drawn) expect(l.links).toHaveLength(1);
    // The domain's lines: one per pair and direction, and together they stand for every cross-aggregate refers_to link.
    const erd = domainErd(i, 'P-D');
    const ids = erd.lines.map((l) => `${l.source}>${l.target}`);
    expect(new Set(ids).size).toBe(ids.length);
    const parentOf = (id: string) => i.byId.get(id)!.parent;
    const crossing = domainLinks.filter((l) => l.relation === 'refers_to' && parentOf(l.source) !== parentOf(l.target));
    expect(erd.lines.filter((l) => !l.dashed).flatMap((l) => l.links)).toHaveLength(crossing.length);
  });

  it('LA-EXP-T126 Above a graph or a model pane the page title keeps one fixed height, so the canvas never moves when the focus changes; in the wiki pane it wraps', async () => {
    await openApp('/P-D-A3?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const title = () => screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('.pane-title')!;
    expect(title()).toHaveClass('is-fixed');
    expect(title()).toHaveAttribute('title', 'Loan');
    expect(CSS).toMatch(/\.pane-title\.is-fixed\s*\{[^}]*height:\s*var\(--pane-title-height\)/);
    expect(CSS).toMatch(/--pane-title-height:\s*\d+px/);
    expect(CSS).toMatch(/\.pane-title\.is-fixed :is\(\.eyebrow, h1, \.record-id\)\s*\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/);
    await openApp('/P-D-EN03?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(title()).toHaveClass('is-fixed');
    await openApp('/P-D-A3?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(title()).not.toHaveClass('is-fixed');
  });

  it('LA-PLT-T50 With three panes open each gap is its own handle, resizing only the two panes beside it', async () => {
    await openApp('/P-D-A3?view=wiki,graph,model', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const first = screen.getByRole('separator', { name: 'Resize the wiki and graph panes' });
    const second = screen.getByRole('separator', { name: 'Resize the graph and model panes' });
    fireEvent.keyDown(second, { key: 'ArrowRight' });
    expect(second).toHaveAttribute('aria-valuenow', '55');
    expect(first).toHaveAttribute('aria-valuenow', '48');
    const views = document.querySelector<HTMLElement>('.focus-views')!;
    expect(views.style.gridTemplateColumns).toBe('minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 110fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 90fr)');
    fireEvent.doubleClick(second);
    expect(views.style.gridTemplateColumns).toBe('minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr) var(--panel-gap) minmax(min(220px, calc((100% - 2 * var(--panel-gap)) / 3)), 100fr)');
  });
});
