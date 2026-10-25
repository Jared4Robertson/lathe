import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpecRecord, Workspace } from '../../lathe/src/types';
import { graphEdgeLabel, graphRelationLabel } from '../src/graph/model';
import { indexWorkspace, type SpecIndex } from '../src/specs/data';
import { branchOf, domainFolders, type FolderGroup } from '../src/specs/folders';
import { pathsOf } from '../src/specs/FlowSteps';
import { linkLabel, relationLabelOf } from '../src/specs/labels';
import { RecordContent } from '../src/specs/RecordContent';
import { judge, owingDomains, traceOf } from '../src/specs/trace';
import { stepsWorkspace } from './fixtures/flow-steps';
import { layerWorkspace } from './fixtures/layers';
import { patternWorkspace } from './fixtures/patterns';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';

// A record's Traceability section (LA-BRW-UC118): its links grouped and titled by their labels
// (LA-BRW-DR243), gap callouts that agree with coverage, a use case's requirement table, and the
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

function rec(id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}): SpecRecord {
  return { id, kind, title, parent, product: 'DM', domain: 'DM-SHOP', fields, body: '', path: `specs/dm/${id}.md`, mentions: [] };
}

describe('traceability', () => {
  it('LA-BRW-T491 An obligation lists Designed by, Proved by and Carried out in, in that order, each component marked built', () => {
    const index = indexWorkspace(workspace());
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

  it('LA-BRW-T492 Gap callouts say not designed, not built and not proved (or only planned), agree with coverage, link to their check, and a pattern rule has one line per domain', () => {
    const index = indexWorkspace(workspace());
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
    const patterns = indexWorkspace(patternWorkspace());
    const r01 = patterns.byId.get('DM-PAT-CHECKOUT-R01')!;
    expect(owingDomains(patterns, r01)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(owingDomains(patterns, patterns.byId.get('DM-PAT-CHECKOUT-R02')!)).toEqual(['DM-PAY']);
    // DM-PAY designs R01 with a component whose file is missing, and only a planned test proves it.
    expect(judge(patterns, r01, 'DM-PAY').gaps.map((g) => [g.kind, g.check])).toEqual([['not-built', 'component-file-missing'], ['only-planned', 'unproved']]);
    expect(judge(patterns, r01, 'DM-SHOP').gaps).toEqual([]);
    trace = show(patterns, 'DM-PAT-CHECKOUT-R01');
    const lines = [...trace.querySelectorAll('.trace-domain')];
    expect(lines.map((l) => l.querySelector('a code')?.textContent)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(lines[0]).toHaveTextContent(/Not built yet.*Not proved yet: its test is only planned/);
    expect(lines[1]).toHaveTextContent('designed, built and proved');

    // The callouts agree with coverage's gaps for every obligation in every domain.
    for (const c of patterns.workspace.coverage) {
      for (const g of c.gaps) {
        const kinds = judge(patterns, patterns.byId.get(g.id)!, c.domain).gaps.map((x) => x.kind);
        expect(kinds).toContain(g.missing === 'satisfies' ? 'not-designed' : kinds.includes('only-planned') ? 'only-planned' : 'not-proved');
      }
    }
  });

  it("LA-BRW-T493 A use case shows a requirement table (Designed, Built, Proved), then what carries it out, follows and applies", () => {
    const w = workspace();
    w.records.push(rec('DM-SHOP-F02', 'flow', 'Fill and check out', 'DM-SHOP'));
    w.links.push({ source: 'DM-SHOP-F02', relation: 'carries_out', target: 'DM-SHOP-UC01' });
    w.relations = [...w.relations, { relation: 'carries_out', source_kind: 'flow', target_kind: 'use_case', role: '', description: '', forward_label: 'Carries out', reverse_label: 'Carried out by flow' }];
    const trace = show(indexWorkspace(w), 'DM-SHOP-UC01');
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

  it('LA-BRW-T494 A component shows Satisfies and Proved through; a test shows Proves and the file that runs it, with its state', () => {
    const index = indexWorkspace(workspace());
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

  it('LA-BRW-T495 Supports links show as Supported by on the obligation and Supports on the test, never as proof', () => {
    const index = indexWorkspace(layerWorkspace());
    let trace = show(index, 'DM-SHOP-DR01');
    expect(groupTitles(trace)).toContain('Supported by');
    expect(groupIds(trace, 'Supported by')).toEqual(['DM-SHOP-T12']);
    expect(groupIds(trace, 'Proved by')).not.toContain('DM-SHOP-T12');
    cleanup();
    trace = show(index, 'DM-SHOP-T12');
    expect(groupTitles(trace)).toEqual(['Supports', 'Run by']);
    expect(traceOf(index, index.byId.get('DM-SHOP-T12')!).groups.map((g) => g.role)).toEqual(['plain']);
  });

  it('LA-BRW-T496 No page shows a relation code as a heading or label: wiki, record facts, graph and Model view read the labels', async () => {
    const w = layerWorkspace();
    const index = indexWorkspace(w);
    const codes = new Set(w.relations.map((r) => r.relation));
    const raw = (text: string) => {
      const t = text.replace(/\d+$/, '').trim();
      return [...codes].some((c) => t === c || t === c.replaceAll('_', ' ') || t === `${c} this` || t === `${c.replaceAll('_', ' ')} this`);
    };
    const offenders: string[] = [];
    for (const r of w.records) {
      await openApp(`/${r.id}`, { workspace: w });
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
    expect(relationLabelOf(w.relations, 'proves', 'target')).toBe('Proved by');
    expect(linkLabel(index, { source: 'DM-SHOP-T12', relation: 'supports', target: 'DM-SHOP-DR01' }, 'target')).toBe('Supported by');
  });

  it('LA-BRW-T497 A flow with several paths shows a table per path, the main path first, then the others by name', () => {
    const w: Workspace = stepsWorkspace();
    const step = (id: string, order: string, title: string, path?: string): SpecRecord => ({ ...rec(id, 'flow_step', title, 'DM-SHOP-F01', { order, ...(path ? { path } : {}) }) });
    w.records.push(step('DM-SHOP-F01-S04', '1', 'The basket is full', 'Refused'), step('DM-SHOP-F01-S05', '2', 'The page says so', 'refused'), step('DM-SHOP-F01-S06', '1', 'A saved basket opens', 'api'));
    const index = indexWorkspace(w);
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

  it('LA-BRW-T498 Sub-layers nest as groups in Technical specification, and a domain rule under an entity sits under that entity', async () => {
    const w = layerWorkspace();
    w.records.push(
      rec('DM-SHOP-LAY04', 'layer', 'Basket services', 'DM-SHOP-LAY03', { order: '1' }),
      rec('DM-SHOP-C06', 'component', 'Basket pricing', 'DM-SHOP-LAY04', { component_type: 'service', file: 'src/C06.ts' }),
      rec('DM-SHOP-EN01', 'entity', 'Basket line', 'DM-SHOP-A1'),
      rec('DM-SHOP-DR02', 'domain_rule', 'A line holds one or more of an item', 'DM-SHOP-EN01'),
    );
    const index = indexWorkspace(w);
    const spec = domainFolders(index, 'DM-SHOP').stages.flatMap((s) => s.folders).find((f) => f.section === 'technical-specification')!;
    const services = spec.groups.find((g) => g.label === 'Services')!;
    const shape = (g: FolderGroup): unknown => ({ label: g.label, records: g.records.map((r) => r.id), groups: g.groups.map(shape) });
    expect(shape(services)).toEqual({ label: 'Services', records: ['DM-SHOP-C04'], groups: [{ label: 'Basket services', records: ['DM-SHOP-C06'], groups: [] }] });
    expect(services.count).toBe(2);
    expect(branchOf(index, 'DM-SHOP-C06')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', 'DM-SHOP/design/technical-specification', 'DM-SHOP/design/technical-specification/DM-SHOP-LAY03', 'DM-SHOP/design/technical-specification/DM-SHOP-LAY03/DM-SHOP-LAY04']);

    // The rule under the entity: the aggregate's page lists the entity with the rule folded under it,
    // and the nav opens to the aggregate holding it.
    await openApp('/DM-SHOP-A1', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'Basket' });
    const entity = screen.getAllByRole('link', { name: /DM-SHOP-EN01/ })[0].closest('li') as HTMLElement;
    expect(entity).toHaveTextContent(/1 domain rule/);
    expect(branchOf(index, 'DM-SHOP-DR02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/define', 'DM-SHOP/define/domain-model']);
  });
});
