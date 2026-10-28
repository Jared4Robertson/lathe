import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphEdgeLabel, graphRelationLabel } from '../src/graph/model';
import { type SpecIndex } from '../src/specs/data';
import { linkLabel, relationLabelOf } from '../src/specs/labels';
import { RecordContent } from '../src/specs/RecordContent';
import { buildersOf, designersOf, judge, notAutomatedTestsOf, owingDomains, traceOf } from '../src/specs/trace';
import { modelWorkspace } from './fixtures/model';
import { patternWorkspace } from './fixtures/patterns';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';
import { indexOf } from './fixtures/load';

// A record's Traceability section (LA-TRC-UC14), on the new model's tree: an obligation is designed
// by what specifies its implementation (the steps fulfilling a UC requirement, the technical records
// carrying out anything else), built when one of those names a file that exists, and proved by the
// tests under it; gap callouts agree with coverage; a use case shows its UC requirements in a table;
// a test shows what it proves and how it is run; other links are titled by their labels (LA-V92-R07).

afterEach(() => cleanup());

/** Renders one record's content on its own, as a host does. */
function show(index: SpecIndex, id: string, side = false) {
  render(<RecordContent index={index} id={id} onNavigate={vi.fn()} side={side} />);
  return screen.getByRole('heading', { level: 2, name: 'Traceability' }).closest('section') as HTMLElement;
}
/** The group headings inside the Traceability section, in order, without their counts. */
const groupTitles = (trace: HTMLElement) => [...trace.querySelectorAll('h3')].map((h) => h.firstChild?.textContent);
/** The record IDs a group lists. */
const groupIds = (trace: HTMLElement, title: string) => {
  const heading = [...trace.querySelectorAll('h3')].find((h) => h.firstChild?.textContent === title)!;
  return [...heading.closest('section')!.querySelectorAll('a.row-link code')].map((c) => c.textContent);
};
const gapKinds = (trace: HTMLElement) => [...trace.querySelectorAll('.trace-gap')].map((g) => g.getAttribute('data-gap'));

describe('traceability', () => {
  it('LA-V92-R56-T01 An obligation lists Designed by, then Proved by; a technical record that designs it is marked built or not', () => {
    // A UC requirement is designed by the steps that fulfill it.
    const index = indexOf(workspace());
    let trace = show(index, 'DM-SHOP-UC01-R01');
    expect(groupTitles(trace)).toEqual(['Designed by', 'Proved by']);
    expect(groupIds(trace, 'Designed by')).toEqual(['DM-SHOP-UC01-FL01-S01']);
    expect(groupIds(trace, 'Proved by')).toEqual(['DM-SHOP-UC01-R01-T01']);
    // A step is no technical record: no built mark; designed, built (through the handler of the command its step invokes) and proved: no gap.
    expect(trace.querySelector('[data-mark="built"]')).toBeNull();
    expect(trace.querySelector('.trace-gap')).toBeNull();
    const r01 = index.byId.get('DM-SHOP-UC01-R01')!;
    expect(buildersOf(index, r01, designersOf(index, r01))).toEqual(['DM-SHOP-CMD01-H']);
    cleanup();

    // An invariant is designed by its aggregate's repository and the tables whose unique key enforces it.
    const model = indexOf(modelWorkspace());
    trace = show(model, 'P-D-INV01');
    expect(groupTitles(trace)).toEqual(['Designed by', 'Proved by']);
    expect(groupIds(trace, 'Designed by')).toEqual(['P-D-A3-REPO', 'P-D-EN03-TB']);
    const marks = [...trace.querySelectorAll('[data-mark="built"]')].map((m) => [m.closest('.trace-row')?.querySelector('code')?.textContent, m.textContent]);
    expect(marks).toEqual([['P-D-A3-REPO', 'built'], ['P-D-EN03-TB', 'not built']]);
    expect(groupIds(trace, 'Proved by')).toEqual(['P-D-INV01-T']);
    // A list mixing kinds tags each row with its kind; a list of one kind does not.
    expect(within(trace).getByText('Repository', { selector: 'small' })).toBeInTheDocument();
    expect(within(trace).queryByText('Invariant test', { selector: 'small' })).toBeNull();
  });

  it('LA-V92-R57-T01 Gap callouts say not designed, not built and not proved (or not automated yet), agree with coverage, link to their check, and a pattern rule has one line per domain', () => {
    const index = indexOf(workspace());
    // Coverage reports DM-SHOP-UC01-R02 not-proved; its step invokes nothing, so nothing builds it.
    let trace = show(index, 'DM-SHOP-UC01-R02');
    expect(gapKinds(trace)).toEqual(['not-built', 'not-proved']);
    expect(within(trace).getByRole('link', { name: 'not-proved' })).toHaveAttribute('href', '/format/checks/not-proved');
    cleanup();
    // DM-PAY-UC01-R01: neither designed nor proved.
    trace = show(index, 'DM-PAY-UC01-R01');
    expect(gapKinds(trace)).toEqual(['not-designed', 'not-proved']);
    expect(within(trace).getByRole('link', { name: 'not-designed' })).toHaveAttribute('href', '/format/checks/not-designed');
    cleanup();
    // An invariant whose only test is not automated yet.
    trace = show(index, 'DM-SHOP-INV01');
    expect(gapKinds(trace)).toContain('not-automated');
    expect(trace).toHaveTextContent('Not proved yet: its test is not automated yet.');
    expect(notAutomatedTestsOf(index, index.byId.get('DM-SHOP-INV01')!)).toEqual(['DM-SHOP-INV01-T']);
    cleanup();

    // A pattern rule, per following domain, proved by its tests that name the domain; it needs no design.
    const patterns = indexOf(patternWorkspace());
    const r01 = patterns.byId.get('DM-PAT-AUDIT-R01')!;
    expect(owingDomains(patterns, r01)).toEqual(['DM-SHOP']);
    // R03 applies only when `who` is clerk, which DM-SHOP marks not applicable: no domain owes it.
    expect(owingDomains(patterns, patterns.byId.get('DM-PAT-AUDIT-R03')!)).toEqual([]);
    expect(judge(patterns, r01, 'DM-SHOP')).toMatchObject({ needsDesign: false, provedBy: ['DM-PAT-AUDIT-R01-T01'], gaps: [] });
    expect(judge(patterns, patterns.byId.get('DM-PAT-AUDIT-R02')!, 'DM-SHOP').gaps.map((g) => [g.kind, g.check])).toEqual([['not-proved', 'not-proved']]);
    trace = show(patterns, 'DM-PAT-AUDIT-R01');
    const lines = [...trace.querySelectorAll('.trace-domain')];
    expect(lines.map((l) => l.querySelector('a code')?.textContent)).toEqual(['DM-SHOP']);
    expect(lines[0]).toHaveTextContent('designed, built and proved');
    cleanup();
    trace = show(patterns, 'DM-PAT-AUDIT-R02');
    expect(trace.querySelector('.trace-domain')).toHaveTextContent('Not proved yet');

    // The callouts agree with coverage's gaps for every obligation in every domain.
    for (const c of patterns.workspace.coverage) {
      for (const g of c.gaps) {
        const judged = judge(patterns, patterns.byId.get(g.id)!, c.domain ?? c.product);
        if (g.missing !== 'proved' && !judged.needsDesign) continue;
        const kinds = judged.gaps.map((x) => x.kind);
        const expected = g.missing === 'designed' ? 'not-designed' : g.missing === 'built' ? 'not-built' : kinds.includes('not-automated') ? 'not-automated' : 'not-proved';
        expect(kinds).toContain(expected);
      }
    }
  });

  it('LA-V92-R58-T01 A use case shows a UC requirement table (Designed, Built, Proved) under its groups, then its links', () => {
    const trace = show(indexOf(patternWorkspace()), 'DM-SHOP-UC01');
    const table = within(trace).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['UC requirement', 'Designed', 'Built', 'Proved']);
    const rows = [...table.querySelectorAll('tbody tr[data-requirement]')] as HTMLElement[];
    expect(rows.map((r) => r.dataset.requirement)).toEqual(['DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    const cells = (r: HTMLElement) => [...r.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells(rows[0])).toEqual(['DM-SHOP-UC01-FL01-S01', 'DM-SHOP-CMD01-H', 'DM-SHOP-UC01-R01-T01']);
    expect(cells(rows[1])).toEqual(['DM-SHOP-UC01-FL01-S03', 'not built', 'not proved']);
    expect(within(rows[0]).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain('/DM-SHOP-UC01-R01-T01');
    // R02 sits under its group's heading.
    expect(table.querySelector('tbody[data-group="Refusals"]')).toHaveTextContent('Refusals');
    expect(groupTitles(trace)).toEqual(['Follows']);
    expect(groupIds(trace, 'Follows')).toEqual(['DM-PAT-AUDIT']);
  });

  it('LA-V92-R59-T01 A test shows Proves (its parent) and how it is run: its level, its state, and the file that runs it or why it is manual', () => {
    const index = indexOf(workspace());
    let trace = show(index, 'DM-SHOP-UC01-R01-T01');
    expect(groupTitles(trace)).toEqual(['Proves', 'Run by']);
    expect(groupIds(trace, 'Proves')).toEqual(['DM-SHOP-UC01-R01']);
    const runBy = within(trace).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(runBy).toHaveTextContent(/Level\s*api/);
    expect(runBy.querySelector('.test-state')).toHaveTextContent('automated');
    expect(runBy).toHaveTextContent(/File\s*test\/basket\.test\.ts\s*file missing/);
    expect(within(runBy).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/format/checks/test-file-missing');
    cleanup();

    // A manual flow test: no file, its reason.
    const model = indexOf(modelWorkspace());
    trace = show(model, 'P-D-UC01-FL01-T');
    expect(groupIds(trace, 'Proves')).toEqual(['P-D-UC01-FL01']);
    const manual = within(trace).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(manual).toHaveTextContent(/Level\s*manual/);
    expect(manual).toHaveTextContent('Manual because');
    expect(manual).toHaveTextContent('Run at the desk before each release.');
    expect(manual).not.toHaveTextContent('File');
    expect(traceOf(model, model.byId.get('P-D-UC01-FL01-T')!).runBy).toMatchObject({ level: 'manual', state: 'manual', file: null });
  });

  it('LA-V92-R07-T01 No page shows a relation code as a heading or label: wiki, record facts, graph and ERD view read the labels', async () => {
    const w = modelWorkspace();
    const index = indexOf(w);
    const codes = new Set(Object.keys(w.schema.relations));
    const raw = (text: string) => {
      const t = text.replace(/\d+$/, '').trim();
      return [...codes].some((c) => t === c || t === c.replaceAll('_', ' ') || t === `${c} this` || t === `${c.replaceAll('_', ' ')} this`);
    };
    const offenders: string[] = [];
    for (const r of index.workspace.records) {
      await openApp(`/${r.id}`, { data: w });
      await screen.findByRole('heading', { level: 1, name: r.title });
      for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, dt, th, legend, label, caption')) {
        if (raw(el.textContent ?? '')) offenders.push(`${r.id}: <${el.tagName.toLowerCase()}> ${el.textContent}`);
      }
    }
    expect(offenders).toEqual([]);

    // The graph's edges, legend and connections, and the ERD view's lines, read the same labels.
    expect(graphEdgeLabel(index, { source: 'P-D-UC01-FL01-S01', relation: 'fulfills', target: 'P-D-UC01-R01' })).toBe('Fulfills');
    expect(graphEdgeLabel(index, { source: 'P-D-UC01-FL01-S01', relation: 'fulfills', target: 'P-D-UC01-R01' }, 'target')).toBe('Fulfilled by');
    expect(graphRelationLabel('happens_in', index)).toBe('Happens in');
    expect(graphRelationLabel('parent', index)).toBe('parent / child');
    expect(relationLabelOf(index.workspace.relations, 'hears', 'target')).toBe('Heard by');
    expect(linkLabel(index, { source: 'P-D-CMD01', relation: 'checks', target: 'P-D-SP01' }, 'target')).toBe('Checked by');
  }, 120_000);

  it('LA-V92-R07-T01 A record\'s links out show under their forward label and its links in under their reverse label; a UC requirement\'s steps are not repeated beside Designed by', () => {
    const index = indexOf(modelWorkspace());
    // A policy: what proves it, then the event it hears.
    let trace = show(index, 'P-D-PO02');
    expect(groupTitles(trace)).toEqual(['Proved by', 'Hears']);
    expect(groupIds(trace, 'Hears')).toEqual(['P-D-EV01']);
    expect(traceOf(index, index.byId.get('P-D-PO02')!).groups.map((g) => g.key)).toEqual(['proof', 'out:Hears']);
    cleanup();
    // The event, read back: raised by its command, heard by the policy.
    trace = show(index, 'P-D-EV01');
    expect(groupIds(trace, 'Heard by')).toEqual(['P-D-PO02']);
    expect(groupIds(trace, 'Raised by')).toEqual(['P-D-CMD01']);
    expect(trace).not.toHaveTextContent('hears');
    cleanup();
    // The steps that fulfill a UC requirement show once, as Designed by.
    trace = show(index, 'P-D-UC01-R01');
    expect(groupTitles(trace)).not.toContain('Fulfilled by');
    expect(groupIds(trace, 'Designed by')).toEqual(['P-D-UC01-FL01-S01']);
  });
});
