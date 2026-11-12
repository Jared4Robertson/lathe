import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GET_RECORD_TRACE } from '../../lathe/src/traceability/record-trace/queries';
import type { RecordTrace } from '../../lathe/src/traceability/record-trace/read-model';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { linkLabel, relationLabelOf } from '../src/specs/labels';
import { Traceability } from '../src/specs/Traceability';
import { modelWorkspace } from './fixtures/model';
import { patternWorkspace } from './fixtures/patterns';
import { workspace } from './fixtures/workspace';
import { openApp, serve } from './helpers';
import { readViewOf, recordIndexOf, type ServedData } from './read-view';

// A record's Traceability section (LA-TRC-UC14), from the Record trace read (get-record-trace): an obligation is
// designed, built and proved by what its chain holds, as the engine works it out, each build record marked built when
// it names a file that exists; gap callouts agree with coverage; a use case shows its UC requirements in a table; a
// test shows what it proves and how it is run; other links are titled by their labels (LA-PAT-RECORD-PAGE-R07).

afterEach(() => cleanup());

/** Renders one record's Traceability section on its own, as a record's page frame does, reading it from the test server. */
async function show(data: ServedData, id: string) {
  serve({ data });
  const index = recordIndexOf(data);
  render(<Traceability index={index} record={index.byId.get(id)!} />);
  return (await screen.findByRole('heading', { level: 2, name: 'Traceability' })).closest('section') as HTMLElement;
}
/** The record's trace, as the Record trace read answers it over the data. */
const traceOf = (data: ServedData, id: string) => answerQuery(readViewOf(data), GET_RECORD_TRACE, { id }) as RecordTrace;
/** How a domain stands on an obligation, from the record's trace. */
const judged = (data: ServedData, id: string, domain: string) => traceOf(data, id).judgments.find((j) => j.domain === domain)!;
/** The group headings inside the Traceability section, in order, without their counts. */
const groupTitles = (trace: HTMLElement) => [...trace.querySelectorAll('h3')].map((h) => h.firstChild?.textContent);
/** The record IDs a group lists. */
const groupIds = (trace: HTMLElement, title: string) => {
  const heading = [...trace.querySelectorAll('h3')].find((h) => h.firstChild?.textContent === title)!;
  return [...heading.closest('section')!.querySelectorAll('a.row-link code')].map((c) => c.textContent);
};
const gapKinds = (trace: HTMLElement) => [...trace.querySelectorAll('.trace-gap')].map((g) => g.getAttribute('data-gap'));

describe('traceability', () => {
  it('LA-V92-R56-T01 An obligation lists Designed by, Built by, then Proved by, as its chain holds them; a build record is marked built or not', async () => {
    // A UC requirement is designed by its fulfilling steps, their flows, the views they happen in and what they invoke,
    // and built by the handlers of what they invoke: the engine's chain, which the Trace stage draws too.
    const data = workspace();
    let trace = await show(data, 'DM-SHOP-UC01-R01');
    expect(groupTitles(trace)).toEqual(['Designed by', 'Built by', 'Proved by']);
    expect(groupIds(trace, 'Designed by')).toEqual(data.chains.find((c) => c.obligation === 'DM-SHOP-UC01-R01')!.design);
    expect(groupIds(trace, 'Designed by')).toEqual(['DM-SHOP-CMD01', 'DM-SHOP-UC01-FL', 'DM-SHOP-UC01-FL-S01']);
    expect(groupIds(trace, 'Built by')).toEqual(['DM-SHOP-CMD01-H']);
    expect(groupIds(trace, 'Proved by')).toEqual(['DM-SHOP-UC01-R01-T01']);
    // Only build records carry the built mark; designed, built and proved: no gap.
    expect([...trace.querySelectorAll('[data-mark="built"]')].map((m) => m.closest('.trace-row')?.querySelector('code')?.textContent)).toEqual(['DM-SHOP-CMD01-H']);
    expect(trace.querySelector('.trace-gap')).toBeNull();
    expect(judged(data, 'DM-SHOP-UC01-R01', 'DM-SHOP').builtBy).toEqual(['DM-SHOP-CMD01-H']);
    cleanup();

    // An invariant is designed by its aggregate and built only by its rule.
    trace = await show(modelWorkspace(), 'P-D-INV01');
    expect(groupTitles(trace)).toEqual(['Designed by', 'Built by', 'Proved by']);
    expect(groupIds(trace, 'Designed by')).toEqual(['P-D-A3']);
    expect(groupIds(trace, 'Built by')).toEqual(['P-D-INV01-RL']);
    const marks = [...trace.querySelectorAll('[data-mark="built"]')].map((m) => [m.closest('.trace-row')?.querySelector('code')?.textContent, m.textContent]);
    expect(marks).toEqual([['P-D-INV01-RL', 'built']]);
    expect(groupIds(trace, 'Proved by')).toEqual(['P-D-INV01-T']);
    cleanup();
    // A list mixing kinds tags each row with its kind (the UC requirement's Designed by); a list of one kind does not.
    trace = await show(data, 'DM-SHOP-UC01-R01');
    expect(within(trace).getByText('Flow step', { selector: 'small' })).toBeInTheDocument();
    expect(within(trace).queryByText('Command handler', { selector: 'small' })).toBeNull();
  });

  it('LA-V92-R57-T01 Gap callouts say not designed, not built and not proved (or not automated yet), agree with coverage, link to their check, and a pattern rule has one line per domain', async () => {
    const data = workspace();
    // Coverage reports DM-SHOP-UC01-R02 not-proved; its step invokes nothing, so nothing builds it.
    let trace = await show(data, 'DM-SHOP-UC01-R02');
    expect(gapKinds(trace)).toEqual(['not-built', 'not-proved']);
    expect(within(trace).getByRole('link', { name: 'not-proved' })).toHaveAttribute('href', expect.stringMatching(/\?page=format\/checks\/not-proved$/));
    cleanup();
    // DM-PAY-UC01-R01: neither designed nor proved.
    trace = await show(data, 'DM-PAY-UC01-R01');
    expect(gapKinds(trace)).toEqual(['not-designed', 'not-proved']);
    expect(within(trace).getByRole('link', { name: 'not-designed' })).toHaveAttribute('href', expect.stringMatching(/\?page=format\/checks\/not-designed$/));
    cleanup();
    // An invariant whose only test is not automated yet.
    trace = await show(data, 'DM-SHOP-INV01');
    expect(gapKinds(trace)).toContain('not-automated');
    expect(trace).toHaveTextContent('Not proved yet: its test is not automated yet.');
    expect(traceOf(data, 'DM-SHOP-INV01').judgments[0].notAutomatedBy).toEqual(['DM-SHOP-INV01-T']);
    cleanup();

    // A pattern rule, per following domain, proved by its tests that name the domain; it needs no design.
    const patterns = patternWorkspace();
    expect(traceOf(patterns, 'DM-PAT-AUDIT-R01').judgments.map((j) => j.domain)).toEqual(['DM-SHOP']);
    // Every rule of a pattern a domain follows is owed there: R03 too.
    expect(traceOf(patterns, 'DM-PAT-AUDIT-R03').judgments.map((j) => j.domain)).toEqual(['DM-SHOP']);
    expect(judged(patterns, 'DM-PAT-AUDIT-R01', 'DM-SHOP')).toMatchObject({ needsDesign: false, provedBy: ['DM-PAT-AUDIT-R01-T01'], gaps: [] });
    expect(judged(patterns, 'DM-PAT-AUDIT-R02', 'DM-SHOP').gaps.map((g) => [g.kind, g.check])).toEqual([['not-proved', 'not-proved']]);
    trace = await show(patterns, 'DM-PAT-AUDIT-R01');
    const lines = [...trace.querySelectorAll('.trace-domain')];
    expect(lines.map((l) => l.querySelector('a code')?.textContent)).toEqual(['DM-SHOP']);
    expect(lines[0]).toHaveTextContent('designed, built and proved');
    cleanup();
    trace = await show(patterns, 'DM-PAT-AUDIT-R02');
    expect(trace.querySelector('.trace-domain')).toHaveTextContent('Not proved yet');

    // The callouts agree with coverage's gaps for every obligation in every domain.
    for (const c of patterns.coverage) {
      for (const g of c.gaps) {
        const standing = judged(patterns, g.id, c.domain ?? c.product);
        if (!standing || (g.missing !== 'proved' && !standing.needsDesign)) continue;
        const kinds = standing.gaps.map((x) => x.kind);
        const expected = g.missing === 'designed' ? 'not-designed' : g.missing === 'built' ? 'not-built' : kinds.includes('not-automated') ? 'not-automated' : 'not-proved';
        expect(kinds).toContain(expected);
      }
    }
  });

  it('LA-V101-R10-T01 A use case shows a UC requirement table (Designed, Built, Proved) under its groups, then its links', async () => {
    const trace = await show(patternWorkspace(), 'DM-SHOP-UC01');
    const table = within(trace).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['UC requirement', 'Designed', 'Built', 'Proved']);
    const rows = [...table.querySelectorAll('tbody tr[data-requirement]')] as HTMLElement[];
    expect(rows.map((r) => r.dataset.requirement)).toEqual(['DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    const cells = (r: HTMLElement) => [...r.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells(rows[0])).toEqual(['DM-SHOP-CMD01DM-SHOP-UC01-FLDM-SHOP-UC01-FL-S01', 'DM-SHOP-CMD01-H', 'DM-SHOP-UC01-R01-T01']);
    expect(cells(rows[1])).toEqual(['DM-SHOP-UC01-FLDM-SHOP-UC01-FL-S03', 'not built', 'not proved']);
    expect(within(rows[0]).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain('/DM-SHOP-UC01-R01-T01');
    // R02 sits under its group's heading.
    expect(table.querySelector('tbody[data-group="Refusals"]')).toHaveTextContent('Refusals');
    expect(groupTitles(trace)).toEqual(['Follows', 'Offered through']);
    expect(groupIds(trace, 'Follows')).toEqual(['DM-PAT-AUDIT']);
    expect(groupIds(trace, 'Offered through')).toEqual(['DM-IF01']);
  });

  it('LA-STD-TRACEABILITY-R02-T05 A technical record lists its helper files under Traceability, and a record with none shows no such list', async () => {
    const data = workspace();
    data.sources[0].tables.helper_file = [
      { record_id: 'DM-SHOP-CMD01-H', file: 'src/basket_unix.ts' },
      { record_id: 'DM-SHOP-CMD01-H', file: 'src/basket_other.ts' },
    ];
    const trace = await show(data, 'DM-SHOP-CMD01-H');
    const helpers = within(trace).getByRole('heading', { level: 3, name: /Helper files/ }).closest('section') as HTMLElement;
    expect([...helpers.querySelectorAll('li code')].map((c) => c.textContent)).toEqual(['src/basket_other.ts', 'src/basket_unix.ts']);
    expect(traceOf(data, 'DM-SHOP-CMD01-H').files.filter((f) => f.helper).map((f) => f.path)).toEqual(['src/basket_other.ts', 'src/basket_unix.ts']);
    cleanup();
    expect(traceOf(workspace(), 'DM-SHOP-CMD01-H').files.filter((f) => f.helper)).toEqual([]);
  });

  it('LA-V92-R59-T01 A test shows Proves (its parent) and how it is run: its level, its state, and the file that runs it or why it is manual', async () => {
    let trace = await show(workspace(), 'DM-SHOP-UC01-R01-T01');
    expect(groupTitles(trace)).toEqual(['Proves', 'Run by']);
    expect(groupIds(trace, 'Proves')).toEqual(['DM-SHOP-UC01-R01']);
    const runBy = within(trace).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(runBy).toHaveTextContent(/Level\s*service/);
    expect(runBy.querySelector('.test-state')).toHaveTextContent('automated');
    expect(runBy).toHaveTextContent(/File\s*test\/basket\.test\.ts\s*file missing/);
    expect(within(runBy).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', expect.stringMatching(/\?page=format\/checks\/test-file-missing$/));
    cleanup();

    // A manual flow test: no file, its reason.
    const model = modelWorkspace();
    trace = await show(model, 'P-D-UC01-FL-T');
    expect(groupIds(trace, 'Proves')).toEqual(['P-D-UC01-FL']);
    const manual = within(trace).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(manual).toHaveTextContent(/Level\s*browser/);
    expect(manual).toHaveTextContent('Manual because');
    expect(manual).toHaveTextContent('Run at the desk before each release.');
    expect(manual).not.toHaveTextContent('File');
    expect(traceOf(model, 'P-D-UC01-FL-T').runBy).toMatchObject({ level: 'browser', state: 'manual', file: null });
  });

  it('LA-PAT-RECORD-PAGE-R07-T01 LA-PAT-RECORD-PAGE-R07-T02 LA-PAT-RECORD-PAGE-R07-T03 LA-PAT-RECORD-PAGE-R07-T04 LA-PAT-RECORD-PAGE-R07-T05 LA-PAT-RECORD-PAGE-R07-T06 No page shows a relation code as a heading or label: wiki, record facts, graph and ERD view read the labels', async () => {
    const w = modelWorkspace();
    const index = recordIndexOf(w);
    const codes = new Set(Object.keys(w.schema.relations));
    const raw = (text: string) => {
      const t = text.replace(/\d+$/, '').trim();
      return [...codes].some((c) => t === c || t === c.replaceAll('_', ' ') || t === `${c} this` || t === `${c.replaceAll('_', ' ')} this`);
    };
    const offenders: string[] = [];
    for (const r of index.byId.values()) {
      await openApp(`/${r.id}`, { data: w });
      await screen.findByRole('heading', { level: 1, name: r.title });
      for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, dt, th, legend, label, caption')) {
        if (raw(el.textContent ?? '')) offenders.push(`${r.id}: <${el.tagName.toLowerCase()}> ${el.textContent}`);
      }
    }
    expect(offenders).toEqual([]);

    // The labels every view reads, by link and by relation.
    expect(linkLabel(index, { source: 'P-D-UC01-FL-S01', relation: 'fulfills', target: 'P-D-UC01-R01' }, 'source')).toBe('Fulfills');
    expect(linkLabel(index, { source: 'P-D-UC01-FL-S01', relation: 'fulfills', target: 'P-D-UC01-R01' }, 'target')).toBe('Fulfilled by');
    expect(relationLabelOf(index.meta.relations, 'presents')).toBe('Presents');
    expect(relationLabelOf(index.meta.relations, 'hears', 'target')).toBe('Heard by');
    expect(linkLabel(index, { source: 'P-D-CMD01', relation: 'checks', target: 'P-D-SP01' }, 'target')).toBe('Checked by');
  }, 120_000);

  it('LA-PAT-RECORD-PAGE-R07-T01 LA-PAT-RECORD-PAGE-R07-T02 LA-PAT-RECORD-PAGE-R07-T03 LA-PAT-RECORD-PAGE-R07-T04 LA-PAT-RECORD-PAGE-R07-T05 LA-PAT-RECORD-PAGE-R07-T06 A record\'s links out show under their forward label and its links in under their reverse label; what its chain holds is not repeated beside it', async () => {
    const data = modelWorkspace();
    // A policy: its command, what proves it, then the event it hears.
    let trace = await show(data, 'P-D-PO02');
    expect(groupTitles(trace)).toEqual(['Designed by', 'Proved by', 'Hears']);
    expect(groupIds(trace, 'Hears')).toEqual(['P-D-EV01']);
    expect(traceOf(data, 'P-D-PO02').links.map((g) => `${g.direction}:${g.relation}`)).toEqual(['out:hears']);
    cleanup();
    // The event, read back: raised by its command, heard by the policy.
    trace = await show(data, 'P-D-EV01');
    expect(groupIds(trace, 'Heard by')).toEqual(['P-D-PO02']);
    expect(groupIds(trace, 'Raised by')).toEqual(['P-D-CMD01']);
    expect(trace).not.toHaveTextContent('hears');
    cleanup();
    // The steps that fulfill a UC requirement show once, in Designed by.
    trace = await show(data, 'P-D-UC01-R01');
    expect(groupTitles(trace)).not.toContain('Fulfilled by');
    expect(groupIds(trace, 'Designed by')).toContain('P-D-UC01-FL-S01');
  });
});
