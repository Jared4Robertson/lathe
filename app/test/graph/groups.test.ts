import { describe, expect, it } from 'vitest';
import {
  childKinds,
  groupLabel,
  groupMarks,
  groupMembers,
  isGraphNode,
  isGrouped,
  neighborhood,
  parseGroupId,
  PARENT,
  pluralLabel,
  traceChain,
  type Filters,
  type Neighborhood,
} from '../../src/graph/model';
import { layoutNeighborhood } from '../../src/graph/layout';
import { addressOf, legacyAddress } from '../../src/views/address';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, testIndex } from './workspace';

const records = (n: Neighborhood) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const groups = (n: Neighborhood) => n.nodes.filter((x) => x.group).map((x) => x.id).sort();
const spine = (n: Neighborhood) => n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });

describe('graph groups', () => {
  const index = testIndex();
  const grouped = indexWorkspace(groupedWorkspace());

  it('LA-BRW-T100 A record with several kinds of child has a group per child kind, labeled with the plural and a count', () => {
    expect(isGrouped(index, 'P-D')).toBe(true);
    expect(childKinds(index, 'P-D')).toEqual(['aggregate', 'use_case', 'view', 'endpoint', 'component', 'test', 'question']);
    // One kind of child: no groups.
    expect(isGrouped(index, 'P-D-UC01')).toBe(false);
    expect(isGrouped(index, 'P-D-A1')).toBe(false);
    expect(isGrouped(index, 'P')).toBe(false);
    // Requirements and a question are two kinds.
    expect(isGrouped(grouped, 'P-D-UC02')).toBe(true);
    expect(groupLabel(grouped, 'P-D-UC02/requirement')).toBe('UC requirements (6)');
    expect(groupLabel(grouped, 'P-D/use_case')).toBe('Use cases (2)');
    expect(groupLabel(index, 'P-D/component')).toBe('Components (2)');
    expect(['question', 'domain_rule', 'domain'].map((k) => pluralLabel(index, k))).toEqual(['Open questions', 'Domain rules', 'Domains']);
    expect(groupMembers(index, 'P-D/component').map((r) => r.id)).toEqual(['P-D-C01', 'P-D-C02']);
    // A group is addressed by its parent and kind, and is not a record.
    expect(parseGroupId('P-D/use_case')).toEqual({ parent: 'P-D', kind: 'use_case', path: [] });
    expect(parseGroupId('P-D-UC01')).toBeNull();
    expect(parseGroupId('file:src/thing.ts')).toBeNull();
    expect(index.byId.has('P-D/use_case')).toBe(false);
    expect(isGraphNode(index, 'P-D/use_case')).toBe(true);
    expect(isGraphNode(index, 'P-D/flow')).toBe(false);
    expect(isGraphNode(index, 'missing/use_case')).toBe(false);
  });

  it('LA-BRW-T101 Groups are folded by default, open when the focus is a member or the person opens them, and the spine runs record, group, record', () => {
    const domain = neighborhood(index, 'P-D', 2);
    expect(groups(domain)).toEqual(childKinds(index, 'P-D').map((k) => `P-D/${k}`).sort());
    expect(domain.nodes.filter((x) => x.group).every((x) => !x.group!.open)).toBe(true);
    // Folded: the domain's children are not shown, only its parent.
    expect(records(domain)).toEqual(['P', 'P-D']);
    expect(domain.nodes.find((x) => x.id === 'P-D/use_case')).toMatchObject({ title: 'Use cases (1)', distance: 1, group: { parent: 'P-D', count: 1, open: false } });
    // Opened by the person: its members appear, one step from the domain, behind the group.
    const opened = neighborhood(index, 'P-D', 2, undefined, new Map([['P-D/use_case', true]]));
    expect(records(opened)).toEqual(['P', 'P-D', 'P-D-UC01']);
    expect(opened.nodes.find((x) => x.id === 'P-D-UC01')!.distance).toBe(1);
    expect(spine(opened)).toContain('P-D > P-D/use_case');
    expect(spine(opened)).toContain('P-D/use_case > P-D-UC01');
    expect(spine(opened)).not.toContain('P-D > P-D-UC01');
    // The focus's own group is open, so its siblings show; the person can close it.
    const uc = neighborhood(grouped, 'P-D-UC01', 2);
    expect(records(uc)).toContain('P-D-UC02');
    expect(uc.nodes.find((x) => x.id === 'P-D/use_case')!.group!.open).toBe(true);
    expect(records(neighborhood(grouped, 'P-D-UC01', 2, undefined, new Map([['P-D/use_case', false]])))).not.toContain('P-D-UC02');
    // A grouped record below the focus: its requirements stay folded.
    const uc2 = neighborhood(grouped, 'P-D-UC02', 2);
    expect(groups(uc2)).toEqual(['P-D-UC02/question', 'P-D-UC02/requirement', 'P-D/use_case']);
    expect(records(uc2).filter((id) => id.startsWith('P-D-UC02-'))).toEqual([]);
    // Cross-links still go record to record.
    const req = neighborhood(index, 'P-D-UC01-R01', 3);
    expect(req.edges.filter((e) => e.relation !== 'parent').every((e) => !parseGroupId(e.source) && !parseGroupId(e.target))).toBe(true);
    expect(req.edges.map((e) => e.id)).toContain('P-D-C01|satisfies|P-D-UC01-R01');
    // Groups do not count as a hop, so the same records are reached at the same distances as before.
    expect(neighborhood(index, 'P-D-C01', 2).nodes.find((x) => x.id === 'P-D')!.distance).toBe(1);
  });

  it('LA-BRW-T277 At depth 1 the graph is the tree around the focus: its parent or folder above, its children or their folders below, no other links', () => {
    const ids = (focus: string, open?: Map<string, boolean>) => neighborhood(grouped, focus, 1, undefined, open).nodes.map((x) => x.id).sort();
    const rels = (focus: string) => new Set(neighborhood(grouped, focus, 1).edges.map((e) => e.relation));
    // A use case in a folder: the folder (folded, so no siblings) above, its requirement below.
    expect(ids('P-D-UC01')).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D/use_case']);
    expect(neighborhood(grouped, 'P-D-UC01', 1).nodes.find((x) => x.id === 'P-D/use_case')!.group!.open).toBe(false);
    // A domain: its product above, one folder per kind of child below.
    expect(ids('P-D')).toEqual(['P', 'P-D', 'P-D/aggregate', 'P-D/component', 'P-D/endpoint', 'P-D/question', 'P-D/test', 'P-D/use_case', 'P-D/view']);
    // A record with several kinds of children reaches them through their folders; a leaf shows only its parent.
    expect(ids('P-D-UC02')).toEqual(['P-D-UC02', 'P-D-UC02/question', 'P-D-UC02/requirement', 'P-D/use_case']);
    expect(ids('P-D-UC01-R01')).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    for (const id of ['P-D-UC01', 'P-D', 'P-D-UC01-R01']) expect([...rels(id)]).toEqual([PARENT]);
    // A folder opened here shows its members, siblings included.
    expect(ids('P-D-UC01', new Map([['P-D/use_case', true]]))).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D-UC02', 'P-D/use_case']);
  });

  it('LA-BRW-T102 A group can be the focus: its parent and all its members are shown', () => {
    const g = neighborhood(grouped, 'P-D/use_case', 2);
    expect(g.nodes[0]).toMatchObject({ id: 'P-D/use_case', distance: 0 });
    expect(records(g)).toEqual(['P-D', 'P-D-UC01', 'P-D-UC02']);
    for (const e of ['P-D > P-D/use_case', 'P-D/use_case > P-D-UC01', 'P-D/use_case > P-D-UC02']) expect(spine(g)).toContain(e);
    // One level each way: at depth 1 no other group shows, neither the parent's nor the members' own.
    expect(g.nodes.filter((x) => x.group).map((x) => x.id)).toEqual(['P-D/use_case']);
    // Depth 2 adds them, folded.
    const two = neighborhood(grouped, 'P-D/use_case', 3);
    expect(two.nodes.filter((x) => x.group && x.id !== 'P-D/use_case').length).toBeGreaterThan(0);
    expect(two.nodes.filter((x) => x.group && x.id !== 'P-D/use_case').every((x) => !x.group!.open)).toBe(true);
    // The focus group cannot be folded.
    expect(records(neighborhood(grouped, 'P-D/use_case', 2, undefined, new Map([['P-D/use_case', false]])))).toContain('P-D-UC01');
    // A group that does not exist shows nothing.
    expect(neighborhood(index, 'P-D/flow', 2).nodes).toEqual([]);
    // Its address.
    // Its address: /<parent-id>/<kind>, and the old /graph address leads there in the Graph view.
    expect(addressOf(grouped, 'P-D/use_case')).toBe('/P-D/use_case');
    expect(legacyAddress('/graph/P-D/use_case')).toBe('/P-D/use_case?view=graph');
    expect(addressOf(grouped, 'P-D-UC01')).toBe('/P-D-UC01');
  });

  it('LA-BRW-T103 Groups take their own column between the parent and its children, left to right', async () => {
    // A group is one column after its parent, and its members one column after the group.
    const column = (n: Neighborhood, id: string) => n.nodes.find((x) => x.id === id)!.column;
    const fromDomain = neighborhood(index, 'P-D', 2, undefined, new Map([['P-D/use_case', true]]));
    expect(column(fromDomain, 'P-D/use_case')).toBe(column(fromDomain, 'P-D') + 1);
    expect(column(fromDomain, 'P-D-UC01')).toBe(column(fromDomain, 'P-D/use_case') + 1);
    const n = neighborhood(grouped, 'P-D/use_case', 3);
    const { positions, layout } = await layoutNeighborhood(n);
    expect(layout).toBe('layered');
    const x = (id: string) => positions.get(id)!.x;
    expect(x('P-D')).toBeLessThan(x('P-D/use_case'));
    expect(x('P-D/use_case')).toBeLessThan(x('P-D-UC01'));
    expect(x('P-D-UC01')).toBe(x('P-D-UC02'));
    expect(x('P-D-UC02')).toBeLessThan(x('P-D-UC02/requirement'));
    // UC02's group and UC01's ungrouped requirement are both one level below a use case, so they share a column.
    expect(x('P-D-UC02/requirement')).toBe(x('P-D-UC01-R01'));
    // Every group's column is one after its parent's and one before its members'.
    for (const g of n.nodes.filter((node) => node.group)) {
      expect(column(n, g.id)).toBe(column(n, g.group!.parent) + 1);
      for (const e of n.edges.filter((e) => e.source === g.id)) expect(column(n, e.target)).toBe(column(n, g.id) + 1);
    }
  });

  it('LA-BRW-T104 A group carries a summary mark when its members or anything beneath them has problems or coverage gaps', () => {
    // The rules beneath the aggregate are not proved, and one is not satisfied.
    expect(groupMarks(index, 'P-D/aggregate')).toEqual({ errors: 0, warnings: 3, gaps: ['proves', 'satisfies'] });
    // The test has an error.
    expect(groupMarks(index, 'P-D/test')).toEqual({ errors: 1, warnings: 0, gaps: [] });
    expect(groupMarks(index, 'P-D/use_case')).toEqual({ errors: 0, warnings: 0, gaps: [] });
  });

  it('LA-BRW-T105 Trace mode has no groups, and filters hide groups with their kind or with the parent relation', () => {
    expect(traceChain(index, 'P-D-UC01-R01').nodes.some((x) => x.group)).toBe(false);
    expect(groups(neighborhood(index, 'P-D', 2, filters(['use_case'])))).not.toContain('P-D/use_case');
    expect(groups(neighborhood(index, 'P-D', 2, filters([], ['parent'])))).toEqual([]);
    expect(groups(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent'])))).toEqual([]);
    // The same graph every time.
    expect(neighborhood(grouped, 'P-D-UC01', 3)).toEqual(neighborhood(grouped, 'P-D-UC01', 3));
  });
});
