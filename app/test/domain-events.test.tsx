import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { indexWorkspace } from '../src/specs/data';
import { aggregateErd, domainErd, endPath, erdFor, lineOffsets } from '../src/model/erd';
import { erdGraph } from '../src/model/layout';
import { ErdKey, lineWords } from '../src/model/ModelView';
import { relationStyle } from '../src/graph/GraphPage';
import { neighborhood } from '../src/graph/model';
import { treeChildren, treeGroup, treeParent } from '../src/graph/tree';
import { openApp, section, startAtDepth } from './helpers';
import { eventWorkspace } from './fixtures/events';

// Domain events in the wiki, the ERD and the graph (brief 60): an aggregate's events as pills on
// its ERD with the entity raising each and the aggregates reacting to it; cause and effect between
// aggregates on a domain's ERD; the aggregate's "Domain events" list and the event's own page; and
// events under their aggregate in the graph, their reacts_to links dashed and labeled.

const served = () => ({ workspace: eventWorkspace() });
const index = () => indexWorkspace(eventWorkspace());
const modelPane = () => screen.getByRole('region', { name: 'Model pane' });
const box = (id: string) => modelPane().querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const boxesShown = () => waitFor(() => expect(modelPane().querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('domain events in the ERD', () => {
  it('LA-BRW-T556 An aggregate\'s ERD draws each of its domain events as a spark pill with a short line from the entity raising it, and the aggregates reacting to it as faded context at the end of a dashed reacts-to line', async () => {
    const erd = aggregateErd(index(), 'P-D-A3');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect(erd.boxes.filter((b) => b.kind === 'event').map((b) => b.id)).toEqual(['P-D-EV01', 'P-D-EV02', 'P-D-EV03']);
    expect(byId.get('P-D-EV01')).toMatchObject({ title: 'Thing lent', tone: 'current', foreign: false, context: false, fields: [{ field: 'Loan ID', kind: 'Whole number' }, { field: 'Thing', kind: 'Thing reference' }] });
    // A short line from the entity raising it, drawn from cause to effect, with plain ends; an event raised by time passing has none.
    const raised = erd.lines.filter((l) => l.relation === 'raised_by');
    expect(raised.map((l) => [l.source, l.target, l.sourceEnd, l.targetEnd, l.dashed, l.reversed])).toEqual([
      ['P-D-EN03', 'P-D-EV01', 'none', 'none', false, true],
      ['P-D-EN04', 'P-D-EV02', 'none', 'none', false, true],
    ]);
    // The reacting aggregates: faded context, another domain's gray with its name; the aggregate's own reaction to its own event draws nothing.
    const reacts = erd.lines.filter((l) => l.relation === 'reacts_to');
    expect(reacts.map((l) => `${l.source}>${l.target}`)).toEqual(['P-D-EV01>P-D-A1', 'P-D-EV01>P-D-A2', 'P-D-EV01>P-E-A1', 'P-D-EV02>P-D-A1', 'P-D-EV03>P-D-A2']);
    for (const l of reacts) expect(l).toMatchObject({ dashed: true, context: true, sourceEnd: 'none', targetEnd: 'arrow' });
    expect(byId.get('P-D-A1')).toMatchObject({ kind: 'aggregate', context: true, foreign: true, tone: 'current', owner: null });
    expect(byId.get('P-E-A1')).toMatchObject({ kind: 'aggregate', context: true, tone: 'other', owner: '(Accounts)' });
    expect(byId.has('P-D-UC01')).toBe(false);
    // An arrow at the reacting end; a plain end draws nothing.
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'arrow').match(/M/g)).toHaveLength(1);
    expect(endPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'none')).toBe('');
    // Laid out so each event sits in the layer right after the entity raising it.
    expect(erdGraph(erd).layoutOptions).toMatchObject({ 'elk.layered.layering.strategy': 'LONGEST_PATH_SOURCE' });
    expect(erdGraph(aggregateErd(index(), 'P-D-A2')).layoutOptions?.['elk.layered.layering.strategy']).toBeUndefined();
    // An event's page draws its aggregate's ERD with its pill picked out.
    expect(erdFor(index(), 'P-D-EV02')).toMatchObject({ level: 'aggregate', scope: 'P-D-A3' });
    expect(erdFor(index(), 'P-D-EV02')!.boxes.filter((b) => b.highlight).map((b) => b.id)).toEqual(['P-D-EV02']);

    await openApp('/records/P-D-A3?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await boxesShown();
    const pill = box('P-D-EV01')!;
    expect(pill.querySelector('.erd-box')).toHaveClass('erd-event', 'tone-current');
    expect(pill).toHaveTextContent('Thing lentDomain event · 2 fields');
    expect(pill).toHaveAttribute('aria-label', 'Domain event Thing lent');
    expect(box('P-D-EV03')).toHaveTextContent('Loan became overdueDomain event');
    expect(box('P-E-A1')).toHaveClass('is-context');
    await waitFor(() => expect(modelPane().querySelector('[data-line="P-D-EN03|raised_by|P-D-EV01"]')).toHaveClass('rel-raised_by'));
    expect(modelPane().querySelector('[data-line="P-D-EN03|raised_by|P-D-EV01"] title')).toHaveTextContent('Thing lent raised by Loan');
    const line = modelPane().querySelector('[data-line="P-D-EV01|reacts_to|P-D-A2"]')!;
    expect(line).toHaveClass('is-dashed', 'is-context', 'has-hover-label');
    expect(line.querySelector('title')).toHaveTextContent('Member reacts to Thing lent');
    // Clicking a pill goes to the event.
    fireEvent.click(pill);
    expect(window.location.pathname).toBe('/records/P-D-EV01');
    // Spark tokens for the pill and its lines (LA-BRW-DR307).
    expect(CSS).toMatch(/\.erd-box\.erd-event\s*\{[^}]*var\(--spark\)[^}]*var\(--spark-bg\)[^}]*border-radius:\s*999px/);
    expect(CSS).toMatch(/\.rel-raised_by, \.rel-reacts_to\) :is\(\.erd-line-path, \.erd-end\) \{ stroke: var\(--spark\)/);
  });

  it('LA-BRW-T557 A domain\'s ERD draws one dashed reacts-to line per aggregate pair and event, from the aggregate raising it to the one reacting, with the event\'s name as its label on hover', async () => {
    const erd = domainErd(index(), 'P-D');
    const reacts = erd.lines.filter((l) => l.relation === 'reacts_to');
    expect(reacts.map((l) => l.id).sort()).toEqual([
      'P-D-A3|reacts_to|P-D-A1|P-D-EV01',
      'P-D-A3|reacts_to|P-D-A1|P-D-EV02',
      'P-D-A3|reacts_to|P-D-A2|P-D-EV01',
      'P-D-A3|reacts_to|P-D-A2|P-D-EV03',
      'P-D-A3|reacts_to|P-E-A1|P-D-EV01',
      'P-E-A1|reacts_to|P-D-A2|P-E-EV01',
    ]);
    // Each stands for exactly one reacts_to link, from an aggregate, to an event raised by another aggregate.
    for (const l of reacts) {
      expect(l.dashed).toBe(true);
      expect(l.links).toHaveLength(1);
      expect(l.links[0]).toMatchObject({ source: l.target, relation: 'reacts_to', target: l.event!.id });
    }
    const aggregateLinks = eventWorkspace().links.filter((l) => l.relation === 'reacts_to' && index().byId.get(l.source)?.kind === 'aggregate');
    const selfReactions = aggregateLinks.filter((l) => index().byId.get(l.target)?.parent === l.source);
    expect(reacts).toHaveLength(aggregateLinks.length - selfReactions.length);
    // Another domain's aggregate is context, and so are the lines to and from it.
    expect(reacts.filter((l) => l.context).map((l) => l.id).sort()).toEqual(['P-D-A3|reacts_to|P-E-A1|P-D-EV01', 'P-E-A1|reacts_to|P-D-A2|P-E-EV01']);
    // The entity references are still one line per pair and direction.
    expect(erd.lines.filter((l) => l.relation === 'refers_to')).toHaveLength(3);
    // Lines between the same boxes fan out, reacts-to lines wider apart.
    const offsets = lineOffsets(erd.lines);
    expect(Math.abs(offsets.get('P-D-A3|reacts_to|P-D-A1|P-D-EV01')! - offsets.get('P-D-A3|reacts_to|P-D-A1|P-D-EV02')!)).toBeGreaterThan(14);
    // Its words: the sentence for the tooltip, and the event's name on hover.
    const line = reacts.find((l) => l.id === 'P-D-A3|reacts_to|P-D-A2|P-D-EV03')!;
    const titles = new Map(erd.boxes.map((b) => [b.id, b.title]));
    expect(lineWords(line, 'reacts to', titles)).toEqual({ label: 'reacts to', title: 'Member reacts to Loan became overdue, raised by Loan', hover: 'Loan became overdue' });

    await openApp('/specs/P/P-D?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    await waitFor(() => expect(modelPane().querySelectorAll('.erd-line.rel-reacts_to')).toHaveLength(6));
    const drawn = modelPane().querySelector('[data-line="P-D-A3|reacts_to|P-D-A2|P-D-EV03"]')!;
    expect(drawn).toHaveClass('is-dashed', 'has-hover-label');
    expect(drawn.querySelector('.erd-line-label')).toHaveTextContent('Loan became overdue');
    expect(drawn.querySelector('.erd-line-hit')).not.toBeNull();
    expect(drawn).toHaveAttribute('data-ends', 'none-arrow');
    expect(within(modelPane()).getByText(/how they react to each other's events/)).toBeInTheDocument();
    // The label shows on hover only, on the shared hover speed (LA-PAT-APP-UX-R01, R04), over a wider stroke to point at.
    expect(CSS).toMatch(/\.erd-line-label\s*\{[^}]*opacity:\s*0;[^}]*transition:\s*opacity var\(--hover-speed\)/);
    expect(CSS).toMatch(/\.erd-line\.has-hover-label:hover \.erd-line-label\s*\{\s*opacity:\s*1/);
    expect(CSS).toMatch(/\.erd-line-hit\s*\{[^}]*pointer-events:\s*stroke/);
    expect(CSS).toMatch(/prefers-reduced-motion: reduce\) \{ \.erd-line-label \{ transition: none/);
    // By touch, with no hover, the event's name always shows (LA-PAT-APP-UX-R07).
    expect(drawn).toHaveClass('has-event');
    expect(CSS).toMatch(/pointer: coarse\) \{ \.erd-line\.has-event \.erd-line-label \{ opacity: 1/);
  });

  it('LA-BRW-T558 The ERD\'s key explains the event pill, the raised-by line and the dashed reacts-to line in the relations\' own words, and keeps its one height', async () => {
    await openApp('/records/P-D-A3?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    await boxesShown();
    const key = within(modelPane()).getByRole('group', { name: 'Key' });
    const events = within(key).getByRole('list', { name: 'Domain events' });
    expect(events).toHaveTextContent('A domain event');
    expect(events).toHaveTextContent('Raised by: the entity whose change raises it');
    expect(events).toHaveTextContent('Reacts to: an aggregate that reacts to the event, faded');
    expect(events.querySelector('.erd-key-event')).not.toBeNull();
    expect(events.querySelector('.erd-key-line.rel-reacts_to.is-dashed')).not.toBeNull();
    expect(key).toHaveTextContent('and the aggregates reacting to its events');

    await openApp('/specs/P/P-D?view=model', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    await boxesShown();
    const domainKey = within(within(modelPane()).getByRole('group', { name: 'Key' })).getByRole('list', { name: 'Domain events' });
    expect(domainKey).toHaveTextContent('Reacts to: the aggregate at the arrow reacts to an event the other raises; hover for the event');
    expect(domainKey).not.toHaveTextContent('A domain event');

    // An event's own ERD rings it, and its key says so.
    const own = erdFor(index(), 'P-D-EV02')!;
    cleanup();
    render(<ErdKey erd={own} highlight relations={eventWorkspace().relations} />);
    const ownKey = screen.getByRole('group', { name: 'Key' });
    expect(ownKey).toHaveTextContent('This event');
    expect(ownKey).not.toHaveTextContent('This entity');
    // The key keeps its one height whatever it lists (LA-PAT-APP-UX-R08).
    expect(CSS).toMatch(/\.erd-key\s*\{[^}]*block-size:\s*var\(--erd-key-height\)/);
  });
});

describe('domain events in the wiki', () => {
  it('LA-BRW-T559 An aggregate\'s page lists its domain events titled "Domain events", each row a whole link saying what raises it and how many react; an event\'s page shows its Fields table, "Raised by" and "Reacted to by", and a reacting record shows "Reacts to"', async () => {
    await openApp('/records/P-D-A3?view=wiki', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const events = section(/^Domain events/);
    const list = within(events).getByRole('list', { name: 'Domain events of P-D-A3' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'P-D-EV01Thing lentRaised by LoanReacted to by 4',
      'P-D-EV02Thing returnedRaised by ReturnReacted to by 2',
      'P-D-EV03Loan became overdueReacted to by 1',
    ]);
    // Each row is one link to its event (LA-PAT-APP-UX-R05).
    expect(within(rows[0]).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[0]).getByRole('link')).toHaveClass('row-link');
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/records/P-D-EV01');
    // The events are not listed again among the children.
    const body = document.querySelector<HTMLElement>('.record-main')!;
    const childrenList = within(body).getByRole('heading', { name: /^Entities/ }).closest('section');
    expect(childrenList).toHaveTextContent('P-D-EN03');
    expect(childrenList).not.toHaveTextContent('P-D-EV01');
    // The aggregate reacts to its own event: "Reacts to".
    expect(within(section(/^Traceability/)).getByRole('heading', { name: /Reacts to/ })).toBeInTheDocument();

    fireEvent.click(within(rows[0]).getByRole('link'));
    await screen.findByRole('heading', { level: 1, name: 'Thing lent' });
    // Its Fields table, as an entity's.
    const table = within(screen.getByRole('main')).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Field', 'Meaning', 'Kind of value', 'Example']);
    expect(within(table).getByRole('cell', { name: 'Thing reference' })).toBeInTheDocument();
    const trace = section(/^Traceability/);
    const raised = within(trace).getByRole('heading', { name: /Raised by/ }).closest('section')!;
    expect(raised).toHaveTextContent('P-D-EN03');
    const reacted = within(trace).getByRole('heading', { name: /Reacted to by/ }).closest('section')!;
    for (const id of ['P-D-A1', 'P-D-A2', 'P-E-A1', 'P-D-UC01']) expect(reacted).toHaveTextContent(id);
    expect(trace).not.toHaveTextContent(/reacts_to|raised_by/);

    await openApp('/records/P-D-A2?view=wiki', served());
    await screen.findByRole('heading', { level: 1, name: 'Member' });
    const reacts = within(section(/^Traceability/)).getByRole('heading', { name: /Reacts to/ }).closest('section')!;
    for (const id of ['P-D-EV01', 'P-D-EV03', 'P-E-EV01']) expect(reacts).toHaveTextContent(id);
  });
});

describe('domain events in the graph', () => {
  it('LA-BRW-T560 Events sit under their aggregate through a "Domain events" group, are drawn as spark pills, and their reacts_to links are dashed, labeled from the meta-model and drawn with the Links switch', async () => {
    const i = index();
    expect(treeChildren(i, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/domain_event']);
    expect(treeGroup(i, 'P-D-A3/domain_event')).toMatchObject({ label: 'Domain events', kind: 'domain_event', count: 3, role: 'kind' });
    expect(treeChildren(i, 'P-D-A3/domain_event')).toEqual(['P-D-EV01', 'P-D-EV02', 'P-D-EV03']);
    expect(treeParent(i, 'P-D-EV01')).toBe('P-D-A3/domain_event');
    // Links on: the event's raised_by and every reacts_to, one hop.
    const links = neighborhood(i, 'P-D-EV01', 1, undefined, undefined, { links: true });
    expect(links.edges.filter((e) => e.relation === 'reacts_to').map((e) => e.source).sort()).toEqual(['P-D-A1', 'P-D-A2', 'P-D-UC01', 'P-E-A1']);
    expect(links.edges.some((e) => e.relation === 'raised_by' && e.target === 'P-D-EN03')).toBe(true);
    const off = neighborhood(i, 'P-D-EV01', 1);
    expect(off.edges.some((e) => e.relation === 'reacts_to')).toBe(false);
    expect(relationStyle('reacts_to')).toBe('event');
    expect(relationStyle('raised_by')).toBe('event');

    startAtDepth(1);
    await openApp('/records/P-D-EV01?view=graph', served());
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
    expect(document.querySelector('.react-flow__node[data-id="P-D-EV01"] .graph-node')).toHaveClass('kind-domain_event');
    expect(document.querySelector('.react-flow__node[data-id="P-D-A3/domain_event"]')).toHaveTextContent('Domain events');
    expect(document.querySelector('.react-flow__edge-path.rel-event')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(document.querySelectorAll('.react-flow__edge-path.rel-event.is-link')).toHaveLength(5));
    const labels = [...document.querySelectorAll('.graph-edge-label')].map((l) => l.textContent);
    expect(labels.filter((l) => l === 'Reacts to')).toHaveLength(4);
    expect(labels).toContain('Raised by');
    // Dashed, in spark, with Links on too; an event node is a spark pill, its group is not.
    expect(CSS).toMatch(/\.react-flow__edge-path\.rel-event, \.graph-flow \.react-flow__edge-path\.rel-event\.is-link \{ stroke: var\(--spark\); stroke-dasharray/);
    expect(CSS).toMatch(/\.graph-node\.kind-domain_event:not\(\.stage-group\)\s*\{[^}]*var\(--spark\)[^}]*var\(--spark-bg\)[^}]*999px/);
  });
});
