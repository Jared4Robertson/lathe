import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../src/views/address';
import { domainErd, erdFor, lineOffsets } from '../src/model/erd';
import { ErdKey, lineWords } from '../src/model/ModelView';
import { hearingPolicies, heardEvent, raisedEvents } from '../src/model/events';
import { openApp, section } from './helpers';
import { modelIndex, modelWorkspace } from './fixtures/model';

// Domain events in the Model view and the wiki: commands raise them, policies hear them (of their own
// domain, or another domain's published ones) and invoke the command they sit under; the aggregate's
// "Domain events" list says what raises each and how many policies hear it.

const served = () => ({ data: modelWorkspace() });
const index = () => modelIndex();
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('domain events in the Model view', () => {
  it('LA-V94-R07-T01 Commands raise events and policies hear them: the lookups follow raises and hears, a policy invokes its parent command, and another domain\'s published event a policy hears is faded context', () => {
    const i = index();
    expect(raisedEvents(i, 'P-D-CMD01').map((e) => e.id)).toEqual(['P-D-EV01']);
    expect(heardEvent(i, 'P-D-PO01')?.id).toBe('P-E-EV01');
    expect(hearingPolicies(i, 'P-D-EV01').map((p) => p.id)).toEqual(['P-D-PO02']);
    const erd = domainErd(i, 'P-D');
    const byId = new Map(erd.boxes.map((b) => [b.id, b]));
    expect(byId.get('P-E-EV01')).toMatchObject({ kind: 'event', context: true, tone: 'other', owner: '(Accounts)' });
  });

  it("LA-EXP-DS11-T002 A domain's ERD draws one dashed line for each policy hearing an event, and one line for each policy invoking its command", () => {
    const erd = domainErd(index(), 'P-D');
    const loop = erd.lines.filter((l) => ['invokes', 'hears'].includes(l.relation)).map((l) => [l.id, l.dashed, l.context]);
    expect(loop.sort()).toEqual([
      ['P-D-EV01|hears|P-D-PO02', true, false],
      ['P-D-PO01|invokes|P-D-CMD04', false, false],
      ['P-D-PO02|invokes|P-D-CMD05', false, false],
      ['P-E-EV01|hears|P-D-PO01', true, true],
    ]);
  });

  it("LA-V94-R08-T01 A domain's ERD shows a dashed hears line with its words on hover, another domain's line as context", () => {
    const erd = domainErd(index(), 'P-D');
    expect(erd.lines.find((l) => l.id === 'P-E-EV01|hears|P-D-PO01')).toMatchObject({ dashed: true, context: true });
    // A dashed line says its words on hover, read the way its link runs.
    const hears = erd.lines.find((l) => l.id === 'P-D-EV01|hears|P-D-PO02')!;
    const titles = new Map(erd.boxes.map((b) => [b.id, b.title]));
    expect(lineWords(hears, 'Hears', titles)).toEqual({ label: 'hears', title: 'When a loan opens, mark the thing lent hears Loan opened', hover: 'hears' });
    // Lines between the same two boxes fan out.
    const offsets = lineOffsets([{ ...hears, id: 'a' }, { ...hears, id: 'b' }]);
    expect(offsets.get('a')).not.toBe(offsets.get('b'));
  });

  it('LA-V94-R09-T01 The key explains the event storming colors and each line in the relations\' own words, and an event\'s page highlights it', () => {
    const i = index();
    const own = erdFor(i, 'P-D-EV02')!;
    render(<ErdKey erd={own} highlight relations={i.workspace.relations} />);
    const key = screen.getByRole('group', { name: 'Key' });
    expect(within(key).getByRole('list', { name: 'Colors' })).toHaveTextContent('Domain event');
    expect(key.querySelector('.erd-key-swatch.erd-key-event')).not.toBeNull();
    const lines = within(key).getByRole('list', { name: 'Lines' });
    expect(lines).toHaveTextContent('Raises');
    expect(lines).toHaveTextContent('Hears (later)');
    // Each line's whole meaning is its entry's tooltip.
    expect(within(lines).getByText(/Hears/).closest('li')).toHaveAttribute('title', 'The policy reacts to the event after it is saved, through the outbox.');
    expect(lines.querySelector('.erd-key-line.rel-hears.is-dashed')).not.toBeNull();
    expect(key).toHaveTextContent('This record');
    cleanup();
  });

  it('LA-V93-R04-T01 Events and their raises and hears lines are drawn in the event color, the hears lines dashed', () => {
    render(<ErdKey erd={erdFor(index(), 'P-D-EV02')!} highlight relations={index().workspace.relations} />);
    const key = screen.getByRole('group', { name: 'Key' });
    expect(key.querySelector('.erd-key-swatch.erd-key-event')).not.toBeNull();
    expect(key.querySelector('.erd-key-line.rel-hears.is-dashed')).not.toBeNull();
    cleanup();
    expect(CSS).toMatch(/\.rel-raises, \.rel-hears\) :is\(\.erd-line-path, \.erd-end\) \{ stroke: var\(--es-event\)/);
  });
});

describe('domain events in the wiki', () => {
  it("LA-V92-R09-T03 An aggregate's events are listed under their kind's plural label, Domain events", async () => {
    await openApp(`${addressOf('P-D-A3')}?view=wiki`, served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A3' })).toBeInTheDocument();
  });

  it('LA-V92-R60-T01 An aggregate\'s page lists its domain events titled "Domain events", each row a whole link saying what raises it, how many policies hear it and whether it is published', async () => {
    await openApp(`${addressOf('P-D-A3')}?view=wiki`, served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const list = within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A3' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'P-D-EV01Loan openedRaised by Open loanHeard by 1',
      'P-D-EV02Thing returnedRaised by Return thing',
    ]);
    // Each row is one link to its event (LA-PAT-APP-UX-R05).
    expect(within(rows[0]).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', addressOf('P-D-EV01'));

    await openApp(`${addressOf('P-D-A2')}?view=wiki`, served());
    await screen.findByRole('heading', { level: 1, name: 'Member' });
    const member = within(within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A2' })).getAllByRole('listitem');
    expect(member.map((r) => r.textContent)).toEqual(['P-D-EV03Member joinedpublishedRaised by Register member']);
  });
});
