import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphEdgeLabel, graphRelationLabel } from '../src/graph/model';
import { type SpecIndex } from '../src/specs/data';
import { branchOf, domainFolders, type FolderGroup } from '../src/specs/folders';
import { pathsOf } from '../src/specs/FlowSteps';
import { linkLabel, relationLabelOf } from '../src/specs/labels';
import { RecordContent } from '../src/specs/RecordContent';
import { judge, owingDomains, traceOf } from '../src/specs/trace';
import { entityWorkspace } from './fixtures/entities';
import { stepsWorkspace } from './fixtures/flow-steps';
import { layerWorkspace } from './fixtures/layers';
import { patternWorkspace } from './fixtures/patterns';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';
import { addRows, indexOf } from './fixtures/load';

// A record's Traceability section (LA-TRC-UC14): its links grouped and titled by their labels
// (LA-EXP-V03-R07), gap callouts that agree with coverage, a use case's requirement table, and the
// structure S2 trial 4 asked for (flow paths, sub-layers, rules under an entity).

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

describe('traceability', () => {
  it('LA-TRC-T112 An obligation lists Designed by, Proved by and Carried out in, in that order, each component marked built', () => {
    const index = indexOf(workspace());
    const trace = show(index, 'DM-SHOP-UC01-R01');
    expect(groupTitles(trace)).toEqual(['Designed by', 'Proved by', 'Carried out in']);
    expect(groupIds(trace, 'Designed by')).toEqual(['DM-SHOP-C01']);
    expect(within(trace).getByText('built')).toHaveAttribute('data-mark', 'built');
    expect(groupIds(trace, 'Proved by')).toEqual(['DM-SHOP-T01']);
    // A list of one kind carries no kind tag; Carried out in mixes kinds, so it does.
    const carried = [...trace.querySelectorAll('h3')].find((h) => h.firstChild?.textContent === 'Carried out in')!.closest('section')!;
    expect(groupIds(trace, 'Carried out in')).toEqual(['DM-SHOP-E01', 'DM-SHOP-F01', 'DM-SHOP-V01']);
    expect(within(carried as HTMLElement).getByText('Endpoint', { selector: 'small' })).toBeInTheDocument();
    expect(within(trace).queryByText('Designed by', { selector: 'small' })).toBeNull();
    // Designed and proved: no gap callout.
    expect(trace.querySelector('.trace-gap')).toBeNull();
  });

  it('LA-TRC-T113 Gap callouts say not designed, not built and not proved (or only planned), agree with coverage, link to their check, and a pattern rule has one line per domain', () => {
    const index = indexOf(workspace());
    // Coverage reports DM-SHOP-UC01-R02 unproved, and DM-PAY-UC01-R01 neither designed nor proved.
    let trace = show(index, 'DM-SHOP-UC01-R02');
    expect([...trace.querySelectorAll('.trace-gap')].map((g) => g.getAttribute('data-gap'))).toEqual(['not-proved']);
    expect(within(trace).getByRole('link', { name: 'unproved' })).toHaveAttribute('href', '/format/checks/unproved');
    cleanup();
    trace = show(index, 'DM-PAY-UC01-R01');
    expect([...trace.querySelectorAll('.trace-gap')].map((g) => g.getAttribute('data-gap'))).toEqual(['not-designed', 'not-proved']);
    expect(within(trace).getByRole('link', { name: 'unsatisfied' })).toHaveAttribute('href', '/format/checks/unsatisfied');
    cleanup();

    // A pattern rule, per following domain: DM-SHOP's R02 is not applicable there, so only DM-PAY owes it.
    const patterns = indexOf(patternWorkspace());
    const r01 = patterns.byId.get('DM-PAT-CHECKOUT-R01')!;
    expect(owingDomains(patterns, r01)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(owingDomains(patterns, patterns.byId.get('DM-PAT-CHECKOUT-R02')!)).toEqual(['DM-PAY']);
    // A pattern rule needs proof only: DM-PAY designs R01 with a component whose file is missing, which is no gap,
    // and only a planned test proves it.
    expect(judge(patterns, r01, 'DM-PAY').gaps.map((g) => [g.kind, g.check])).toEqual([['only-planned', 'unproved']]);
    expect(judge(patterns, r01, 'DM-SHOP').gaps).toEqual([]);
    trace = show(patterns, 'DM-PAT-CHECKOUT-R01');
    const lines = [...trace.querySelectorAll('.trace-domain')];
    expect(lines.map((l) => l.querySelector('a code')?.textContent)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(lines[0]).toHaveTextContent('Not proved yet: its test is only planned');
    expect(lines[0]).not.toHaveTextContent('Not built yet');
    expect(lines[1]).toHaveTextContent('designed, built and proved');

    // The callouts agree with coverage's gaps for every obligation in every domain (a kind that needs proof only owes no design).
    for (const c of patterns.workspace.coverage) {
      for (const g of c.gaps) {
        const judged = judge(patterns, patterns.byId.get(g.id)!, c.domain);
        if (g.missing === 'satisfies' && !judged.needsDesign) continue;
        const kinds = judged.gaps.map((x) => x.kind);
        expect(kinds).toContain(g.missing === 'satisfies' ? 'not-designed' : kinds.includes('only-planned') ? 'only-planned' : 'not-proved');
      }
    }
  });

  it("LA-TRC-T114 A use case shows a requirement table (Designed, Built, Proved), then what carries it out, follows and applies", () => {
    const w = workspace();
    addRows(w, 'flow', { id: 'DM-SHOP-F02', title: 'Fill and check out', domain_id: 'DM-SHOP' });
    addRows(w, 'carries_out', { source_id: 'DM-SHOP-F02', target_id: 'DM-SHOP-UC01' });
    const trace = show(indexOf(w), 'DM-SHOP-UC01');
    const table = within(trace).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Requirement', 'Designed', 'Built', 'Proved']);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLElement[];
    expect(rows.map((r) => r.dataset.requirement)).toEqual(['DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    const cells = (r: HTMLElement) => [...r.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells(rows[0])).toEqual(['DM-SHOP-C01', 'DM-SHOP-C01', 'DM-SHOP-T01']);
    expect(cells(rows[1])).toEqual(['DM-SHOP-C01', 'DM-SHOP-C01', 'not proved']);
    expect(within(rows[0]).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain('/DM-SHOP-T01');
    expect(groupTitles(trace)).toEqual(['Carried out by flow', 'Applies']);
    expect(groupIds(trace, 'Applies')).toEqual(['DM-SHOP-DR01']);
    // Each applied rule shows its own status, as every row does.
    expect(within(trace).getByText('not proved', { selector: '.record-row .badge' })).toBeInTheDocument();
  });

  it('LA-TRC-T115 A component shows Satisfies and Proved through; a test shows Proves and the file that runs it, with its state', () => {
    const index = indexOf(workspace());
    let trace = show(index, 'DM-SHOP-C01');
    expect(groupTitles(trace)).toEqual(['Satisfies', 'Proved through', 'Implements']);
    expect(groupIds(trace, 'Satisfies')).toEqual(['DM-SHOP-DR01', 'DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    expect(groupIds(trace, 'Proved through')).toEqual(['DM-SHOP-T01']);
    cleanup();
    trace = show(index, 'DM-SHOP-T01');
    expect(groupTitles(trace)).toEqual(['Proves', 'Run by']);
    const runBy = within(trace).getByRole('heading', { level: 3, name: 'Run by' }).closest('section') as HTMLElement;
    expect(runBy).toHaveTextContent(/test\/basket\.test\.ts\s*automated\s*file missing/);
    expect(within(runBy).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/format/checks/test-file-missing');
  });

  it('LA-TRC-T116 Supports links show as Supported by on the obligation and Supports on the test, never as proof', () => {
    const index = indexOf(layerWorkspace());
    let trace = show(index, 'DM-SHOP-DR01');
    expect(groupTitles(trace)).toContain('Supported by');
    expect(groupIds(trace, 'Supported by')).toEqual(['DM-SHOP-T12']);
    expect(groupIds(trace, 'Proved by')).not.toContain('DM-SHOP-T12');
    cleanup();
    trace = show(index, 'DM-SHOP-T12');
    expect(groupTitles(trace)).toEqual(['Supports', 'Run by']);
    expect(traceOf(index, index.byId.get('DM-SHOP-T12')!).groups.map((g) => g.role)).toEqual(['plain']);
  });

  it('LA-EXP-T135 No page shows a relation code as a heading or label: wiki, record facts, graph and Model view read the labels', async () => {
    const w = layerWorkspace();
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

    // The graph's edges, legend and connections, and the Model view's lines, read the same labels.
    expect(graphEdgeLabel(index, { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-SHOP-DR01' })).toBe('Satisfies');
    expect(graphEdgeLabel(index, { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-SHOP-DR01' }, 'target')).toBe('Designed by');
    expect(graphRelationLabel('depends_on', index)).toBe('Depends on');
    expect(graphRelationLabel('parent', index)).toBe('parent / child');
    expect(relationLabelOf(index.workspace.relations, 'proves', 'target')).toBe('Proved by');
    expect(linkLabel(index, { source: 'DM-SHOP-T12', relation: 'supports', target: 'DM-SHOP-DR01' }, 'target')).toBe('Supported by');
  });

  it('LA-EXP-T136 A flow with several paths shows a table per path, the main path first, then the others by name', () => {
    const w = stepsWorkspace();
    const step = (id: string, position: number, title: string, path: string) => ({ id, title, flow_id: 'DM-SHOP-F01', path, position });
    addRows(w, 'flow_step', step('DM-SHOP-F01-S04', 1, 'The basket is full', 'Refused'), step('DM-SHOP-F01-S05', 2, 'The page says so', 'refused'), step('DM-SHOP-F01-S06', 1, 'A saved basket opens', 'api'));
    const index = indexOf(w);
    expect(pathsOf(index, 'DM-SHOP-F01').map((p) => [p.path, p.steps.map((s) => s.id)])).toEqual([
      ['main', ['DM-SHOP-F01-S02', 'DM-SHOP-F01-S03', 'DM-SHOP-F01-S01']],
      ['api', ['DM-SHOP-F01-S06']],
      ['refused', ['DM-SHOP-F01-S04', 'DM-SHOP-F01-S05']],
    ]);
    render(<RecordContent index={index} id="DM-SHOP-F01" onNavigate={vi.fn()} />);
    const steps = screen.getByRole('heading', { level: 2, name: /^Steps/ }).closest('section') as HTMLElement;
    expect([...steps.querySelectorAll('h3')].map((h) => h.firstChild?.textContent)).toEqual(['Main path', 'Api path', 'Refused path']);
    const tables = within(steps).getAllByRole('table');
    expect(tables.map((t) => [...t.querySelectorAll('tbody tr.flow-step')].map((tr) => (tr as HTMLElement).dataset.step))).toEqual([
      ['DM-SHOP-F01-S02', 'DM-SHOP-F01-S03', 'DM-SHOP-F01-S01'], ['DM-SHOP-F01-S06'], ['DM-SHOP-F01-S04', 'DM-SHOP-F01-S05'],
    ]);
  });

  it('LA-EXP-T137 Sub-layers nest as groups in Technical specification, and a domain rule under an entity sits under that entity', async () => {
    const w = layerWorkspace();
    addRows(w, 'layer', { id: 'DM-SHOP-LAY04', title: 'Basket services', domain_id: 'DM-SHOP', parent_layer_id: 'DM-SHOP-LAY03', position: 1 });
    addRows(w, 'component', { id: 'DM-SHOP-C06', title: 'Basket pricing', domain_id: 'DM-SHOP', layer_id: 'DM-SHOP-LAY04', component_type: 'service', file: 'src/C06.ts' });
    addRows(w, 'entity', { id: 'DM-SHOP-EN01', title: 'Basket line', aggregate_id: 'DM-SHOP-A1', role: 'root' });
    addRows(w, 'domain_rule', { id: 'DM-SHOP-DR02', title: 'A line holds one or more of an item', domain_id: 'DM-SHOP', aggregate_id: 'DM-SHOP-A1', entity_id: 'DM-SHOP-EN01', statement: 'A line MUST hold one or more of an item.' });
    const index = indexOf(w);
    const spec = domainFolders(index, 'DM-SHOP').stages.flatMap((s) => s.folders).find((f) => f.section === 'technical-specification')!;
    const services = spec.groups.find((g) => g.label === 'Services')!;
    const shape = (g: FolderGroup): unknown => ({ label: g.label, records: g.records.map((r) => r.id), groups: g.groups.map(shape) });
    expect(shape(services)).toEqual({ label: 'Services', records: ['DM-SHOP-C04'], groups: [{ label: 'Basket services', records: ['DM-SHOP-C06'], groups: [] }] });
    expect(services.count).toBe(2);
    expect(branchOf(index, 'DM-SHOP-C06')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', 'DM-SHOP/design/technical-specification', 'DM-SHOP/design/technical-specification/DM-SHOP-LAY03', 'DM-SHOP/design/technical-specification/DM-SHOP-LAY03/DM-SHOP-LAY04']);

    // The rule under the entity: the aggregate's page lists the entity with the rule folded under it,
    // and the nav opens to the aggregate holding it.
    await openApp('/DM-SHOP-A1', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Basket' });
    const entity = screen.getAllByRole('link', { name: /DM-SHOP-EN01/ })[0].closest('li') as HTMLElement;
    expect(entity).toHaveTextContent(/1 domain rule/);
    expect(branchOf(index, 'DM-SHOP-DR02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/define', 'DM-SHOP/define/domain-model']);
  });

  it('LA-TRC-T117 A domain rule under its domain shows the aggregates it involves under "Involves", and each aggregate shows it under "Involved in"; an interaction requirement\'s Carries out is not repeated', () => {
    const w = entityWorkspace();
    // The involves relation as the schema has it, labels and all.
    const involves = w.schema.relations.involves;
    expect([involves.pairs.map((p) => `${p.source}>${p.target}`), involves.role, involves.forwardLabel, involves.reverseLabel]).toEqual([['domain_rule>aggregate'], null, 'Involves', 'Involved in']);
    addRows(w, 'domain_rule', { id: 'P-D-DR90', title: 'A loan and its thing change together', domain_id: 'P-D', statement: 'A loan and its thing MUST change together.' });
    addRows(w, 'involves', { source_id: 'P-D-DR90', target_id: 'P-D-A3' }, { source_id: 'P-D-DR90', target_id: 'P-D-A1' });
    const index = indexOf(w);
    let trace = show(index, 'P-D-DR90');
    // After what designs and proves it (here nothing), its links out under their forward label.
    expect(groupTitles(trace)).toEqual(['Involves']);
    expect(groupIds(trace, 'Involves')).toEqual(['P-D-A1', 'P-D-A3']);
    expect(traceOf(index, index.byId.get('P-D-DR90')!).groups.map((g) => g.key)).toEqual(['out:Involves']);
    cleanup();
    trace = show(index, 'P-D-A1');
    expect(groupIds(trace, 'Involved in')).toEqual(['P-D-DR90']);
    expect(trace).not.toHaveTextContent('involves');
    cleanup();

    // An interaction requirement's Carries out has its own section on its page, so its Traceability leaves it out.
    const lw = layerWorkspace();
    const id = 'DM-SHOP-V01-IR01';
    addRows(lw, 'fulfills', { source_id: id, target_id: 'DM-SHOP-UC02-R01' });
    const ir = indexOf(lw);
    trace = show(ir, id);
    expect(groupTitles(trace)).not.toContain('Carries out');
    expect(traceOf(ir, ir.byId.get(id)!).groups.map((g) => g.key)).toContain('out:Carries out');
  });
});
