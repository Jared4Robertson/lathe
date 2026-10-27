import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aggregateErd, domainErd, endPath, erdFor, lineGeometry } from '../src/model/erd';
import { erdGraph } from '../src/model/layout';
import { viewsOffered, viewsShown } from '../src/views/address';
import { openApp } from './helpers';
import { modelIndex, modelWorkspace } from './fixtures/model';

// The Model view: a domain's aggregates with what sits around them, and an aggregate's entities with
// its commands, events and policies, in event storming colors; offered on the kinds it draws.

const served = () => ({ data: modelWorkspace() });
const index = () => modelIndex();
const modelPane = () => screen.getByRole('region', { name: 'Model pane' });
const box = (id: string) => modelPane().querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const boxesShown = () => waitFor(() => expect(modelPane().querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
const viewToggle = (name: string) => within(screen.getByRole('group', { name: 'View' })).queryByRole('button', { name });
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const lineIds = (erd: { lines: { id: string }[] }) => erd.lines.map((l) => l.id).sort();

describe('the Model view', () => {
  const proveLaExpSp02T = async () => {
    const i = index();
    for (const id of ['P-D', 'P-D-A3', 'P-D-EN03', 'P-D-CMD01', 'P-D-EV01', 'P-D-PO01', 'P-D-RM01', 'P-D-QRY01', 'P-D-SP01']) {
      expect(viewsOffered(i, id)).toEqual(['wiki', 'graph', 'model']);
    }
    for (const id of ['P', 'P-D-UC01', 'P-VO01', 'P-D-UC01-FL']) expect(viewsOffered(i, id)).toEqual(['wiki', 'graph']);
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
    await boxesShown();
    // Alt+M turns it off again (off a Mac).
    fireEvent.keyDown(document.body, { key: 'm', code: 'KeyM', altKey: true });
    expect(window.location.search).toBe('?view=wiki,graph');
  };
  it('LA-EXP-SP02-T Model is offered on a domain and the kinds of its model, opens as a third pane after Wiki and Graph, and an address naming it elsewhere drops it', proveLaExpSp02T);
  it('LA-V96-R18-T01 Model is offered only on a domain and the kinds of its model, as the third pane', proveLaExpSp02T);

  const proveLaV94R02T01 = async () => {
    const erd = domainErd(index(), 'P-D');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect(erd.boxes.filter((b) => b.kind === 'aggregate' && !b.context).map((b) => b.id)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4']);
    expect(byId.get('P-D-A3')).toMatchObject({
      tone: 'current',
      entities: [{ id: 'P-D-EN03', title: 'Loan', root: true }, { id: 'P-D-EN04', title: 'Return', root: false }, { id: 'P-D-EN05', title: 'Reminder', root: false }],
      valueObjects: [],
    });
    expect(byId.get('P-D-A1')).toMatchObject({ valueObjects: ['Name'] });
    // Another domain's aggregate and its published event: gray, faded, named in parentheses.
    expect(byId.get('P-E-A1')).toMatchObject({ kind: 'aggregate', tone: 'other', owner: '(Accounts)', foreign: true, context: true });
    expect(byId.get('P-E-EV01')).toMatchObject({ kind: 'event', tone: 'other', context: true });
    expect(Object.fromEntries(erd.boxes.filter((b) => b.kind !== 'aggregate').map((b) => [b.id, b.kind]))).toEqual({
      'P-D-CMD01': 'command', 'P-D-CMD02': 'command', 'P-D-CMD03': 'command', 'P-D-CMD04': 'command', 'P-D-CMD05': 'command',
      'P-D-EV01': 'event', 'P-D-EV02': 'event', 'P-D-EV03': 'event', 'P-E-EV01': 'event',
      'P-D-PO01': 'policy', 'P-D-PO02': 'policy', 'P-D-SP01': 'specification', 'P-D-RM01': 'read_model', 'P-D-QRY01': 'query',
    });
    // References: one line per pair, many to one, with the fields that refer.
    const refs = erd.lines.filter((l) => l.relation === 'refers_to');
    expect(refs.map((l) => [l.id, l.sourceEnd, l.targetEnd, l.via])).toEqual([
      ['P-D-A2|refers_to|P-E-A1', 'many', 'one', ['Member.Account']],
      ['P-D-A3|refers_to|P-D-A1', 'many', 'one', ['Loan.Thing']],
      ['P-D-A3|refers_to|P-D-A2', 'many', 'one', ['Loan.Member', 'Reminder.Member']],
      ['P-D-A4|refers_to|P-D-A1', 'many', 'one', ['Shelf.Thing']],
    ]);
    // The event storming loop: policy invokes command, command changes its aggregate and raises events, a policy hears an event.
    expect(lineIds(erd)).toEqual(expect.arrayContaining([
      'P-D-PO02|invokes|P-D-CMD05', 'P-D-CMD05|changes|P-D-A1', 'P-D-CMD01|raises|P-D-EV01', 'P-D-EV01|hears|P-D-PO02',
      'P-E-EV01|hears|P-D-PO01', 'P-D-CMD02|also_changes|P-D-A1', 'P-D-CMD01|checks|P-D-SP01', 'P-D-SP01|reads|P-D-A2',
      'P-D-SP01|reads|P-D-A3', 'P-D-A1|reads|P-D-RM01', 'P-D-RM01|queries|P-D-QRY01',
    ]));
    const hears = erd.lines.find((l) => l.id === 'P-D-EV01|hears|P-D-PO02')!;
    expect(hears).toMatchObject({ dashed: true, reversed: true, sourceEnd: 'none', targetEnd: 'arrow' });
    // Events sit after their aggregate in the layout.
    expect(erdGraph(erd).edges).toEqual(expect.arrayContaining([expect.objectContaining({ sources: ['P-D-A3'], targets: ['P-D-EV01'] })]));

    await openApp('/P-D?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    expect(box('P-D-A3')!.querySelector('.erd-box')).toHaveClass('erd-aggregate', 'tone-current');
    expect(within(box('P-D-A3')!).getByRole('list', { name: 'Entities of Loan' })).toHaveTextContent('LoanrootReturnReminder');
    expect(box('P-D-A1')).toHaveTextContent('Value objects: Name');
    expect(box('P-D-CMD01')!.querySelector('.erd-box')).toHaveClass('erd-command');
    expect(box('P-D-PO01')!.querySelector('.erd-box')).toHaveClass('erd-policy');
    expect(box('P-E-A1')).toHaveClass('is-context');
    expect(box('P-E-A1')).toHaveTextContent('(Accounts)');
    await waitFor(() => expect(modelPane().querySelectorAll('.erd-line')).toHaveLength(erd.lines.length));
    expect(modelPane().querySelector('[data-line="P-D-EV01|hears|P-D-PO02"]')).toHaveClass('is-dashed', 'has-hover-label');
    expect(modelPane().querySelector('[data-line="P-D-EV01|hears|P-D-PO02"] title')).toHaveTextContent('When a loan opens, mark the thing lent hears Loan opened');
    expect(modelPane().querySelector('[data-line="P-D-A3|refers_to|P-D-A2"] title')).toHaveTextContent('Loan refers to Member (Loan.Member; Reminder.Member)');
  };
  it('LA-V94-R02-T01 A domain\'s model draws each aggregate with its entities and value objects, one many-to-one line per aggregate it refers to, and the commands, events, policies, specifications, read models and queries around them', proveLaV94R02T01);
  it('LA-V94-R01-T01 A domain\'s model draws its aggregates, the lines between them and their records', proveLaV94R02T01);

  const proveLaV94R03T01 = async () => {
    const erd = aggregateErd(index(), 'P-D-A3');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect(byId.get('P-D-EN03')).toMatchObject({
      root: true,
      fields: [{ field: 'Loan ID', kind: 'whole number' }, { field: 'Thing', kind: '→ Thing' }, { field: 'Member', kind: '→ Member' }, { field: 'Due date', kind: 'date' }],
    });
    expect(byId.get('P-D-A1')).toMatchObject({ kind: 'aggregate', context: true, tone: 'current' });
    expect(byId.get('P-D-EV01')).toMatchObject({ kind: 'event', context: false, fields: [{ field: 'Loan', kind: '→ Loan' }, { field: 'Thing', kind: '→ Thing' }] });
    // A policy elsewhere hearing its event is faded context; so is the aggregate a recorded exception also changes.
    expect(byId.get('P-D-PO02')).toMatchObject({ kind: 'policy', context: true });
    const ends = Object.fromEntries(erd.lines.map((l) => [l.id, `${l.sourceEnd}-${l.targetEnd}`]));
    expect(ends).toMatchObject({
      'P-D-EN03|has_one|P-D-EN04': 'one-one',
      'P-D-EN03|has_many|P-D-EN05': 'one-many',
      'P-D-EN03|refers_to|P-D-A1': 'many-one',
      'P-D-EN05|refers_to|P-D-A2': 'many-one',
      'P-D-CMD01|changes|P-D-EN03': 'none-arrow',
      'P-D-CMD01|raises|P-D-EV01': 'none-arrow',
      'P-D-CMD02|also_changes|P-D-A1': 'none-arrow',
      'P-D-CMD01|checks|P-D-SP01': 'none-arrow',
      'P-D-EV01|hears|P-D-PO02': 'none-arrow',
    });
    expect(erd.lines.find((l) => l.relation === 'also_changes')).toMatchObject({ dashed: true, via: ['The thing must be lendable again in the same transaction as its return.'] });
    // A crow's foot has three prongs and a bar; one is two bars; an arrow one stroke.
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'many').match(/M/g)).toHaveLength(4);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'one').match(/M/g)).toHaveLength(2);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'arrow').match(/M/g)).toHaveLength(1);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'none')).toBe('');
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
    expect(fields).toEqual(['Loan IDwhole number', 'Thing→ Thing', 'Member→ Member', 'Due datedate']);
    expect(box('P-D-EV01')!.querySelector('.erd-box')).toHaveClass('erd-event');
    expect(box('P-D-EV01')).toHaveAttribute('aria-label', 'Domain event Loan opened');
    expect(box('P-D-A1')).toHaveClass('is-context');
    await waitFor(() => expect(modelPane().querySelector('[data-line="P-D-EN03|has_many|P-D-EN05"]')).toHaveAttribute('data-ends', 'one-many'));
  };
  it('LA-V94-R03-T01 An aggregate\'s model shows each entity\'s title, root mark and fields with their types, crow\'s-foot ends by cardinality, the aggregates it refers to faded, and its commands, events and policies', proveLaV94R03T01);
  it('LA-V94-R01-T02 An aggregate\'s model shows its entities with their fields and crow\'s-foot ends', proveLaV94R03T01);

  it('LA-V94-R04-T01 An entity, command, event or policy page draws its aggregate\'s model with that record highlighted; a read model, query or specification page its domain\'s', async () => {
    expect(erdFor(index(), 'P-D-EN04')).toMatchObject({ level: 'aggregate', scope: 'P-D-A3' });
    expect(erdFor(index(), 'P-D-EN04')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-EN04']);
    expect(erdFor(index(), 'P-D-CMD02')).toMatchObject({ level: 'aggregate', scope: 'P-D-A3' });
    expect(erdFor(index(), 'P-D-EV02')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-EV02']);
    // A policy belongs to its command's aggregate.
    expect(erdFor(index(), 'P-D-PO01')).toMatchObject({ level: 'aggregate', scope: 'P-D-A2' });
    expect(erdFor(index(), 'P-D-RM01')).toMatchObject({ level: 'domain', scope: 'P-D' });
    expect(erdFor(index(), 'P-D-SP01')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-SP01']);
    expect(erdFor(index(), 'P-D-UC01')).toBeNull();

    await openApp('/P-D-EN04?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Return' });
    await boxesShown();
    expect(box('P-D-EN04')!.querySelector('.erd-box')).toHaveClass('is-highlight', 'is-focus');
    expect(box('P-D-EN03')!.querySelector('.erd-box')).not.toHaveClass('is-highlight');
    expect(within(modelPane()).getByRole('group', { name: 'Key' })).toHaveTextContent('This record');
  });

  it('LA-V94-R05-T01 Clicking a box goes to it, boxes show a hover state, and a key under the diagram explains the event storming colors and every line drawn', async () => {
    await openApp('/P-D?view=wiki,model', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const key = within(modelPane()).getByRole('group', { name: 'Key' });
    const colors = within(key).getByRole('list', { name: 'Colors' });
    for (const text of ['Policy', 'Command', 'Specification', 'Aggregate', 'Domain event', 'Read model', 'Query', 'This domain', 'Other domain, in parentheses']) expect(colors).toHaveTextContent(text);
    const lines = within(key).getByRole('list', { name: 'Lines' });
    expect(lines).toHaveTextContent('Refers to (n:1)');
    expect(lines).toHaveTextContent('Raises');
    expect(lines).toHaveTextContent('Hears (later)');
    expect(lines.querySelector('.erd-key-line.rel-hears.is-dashed')).not.toBeNull();
    // Under the diagram, keeping one height.
    expect(modelPane().querySelector('.model-canvas')!.compareDocumentPosition(key.closest('.erd-key')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(CSS).toMatch(/\.erd-key\s*\{[^}]*block-size:\s*var\(--erd-key-height\)/);
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
    // Colors come from the event storming tokens; another domain is gray.
    expect(CSS).toMatch(/\.erd-box\s*\{[^}]*var\(--es-aggregate\)[^}]*var\(--es-aggregate-bg\)/);
    for (const kind of ['command', 'event', 'policy']) expect(CSS).toMatch(new RegExp(`\\.erd-box\\.erd-${kind}\\s*\\{[^}]*var\\(--es-${kind}\\)`));
    expect(CSS).toMatch(/\.erd-box\.tone-other\s*\{[^}]*var\(--muted\)[^}]*var\(--paper\)/);
  });

  it('LA-EXP-DS11-T01 A domain\'s model draws each raises, checks, hears and reads link of its records exactly once', () => {
    const i = index();
    const erd = domainErd(i, 'P-D');
    const drawn = new Set(erd.lines.map((l) => (l.reversed ? `${l.target}|${l.relation}|${l.source}` : `${l.source}|${l.relation}|${l.target}`)));
    const links = i.workspace.links.filter((l) => ['raises', 'checks', 'hears', 'reads'].includes(l.relation) && (i.byId.get(l.source)?.domain === 'P-D'));
    expect(links.length).toBeGreaterThan(8);
    for (const l of links) expect(drawn.has(`${l.source}|${l.relation}|${l.target}`)).toBe(true);
    const ids = erd.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('LA-V96-R09-T01 Above a graph or a model pane the page title keeps one fixed height, so the canvas never moves when the focus changes; in the wiki pane it wraps', async () => {
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

  const proveLaV61R02T03 = async () => {
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
  };
  it('LA-V61-R02-T03 With three panes open each gap is its own handle, resizing only the two panes beside it', proveLaV61R02T03);
  it('LA-V61-R03-T04 With three panes open each gap is its own handle, resizing only the two panes beside it', proveLaV61R02T03);
});
