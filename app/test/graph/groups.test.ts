import { describe, expect, it } from 'vitest';
import {
  childKinds,
  groupLabel,
  groupMarks,
  groupMembers,
  isGraphNode,
  isGrouped,
  neighbourhood,
  parseGroupId,
  pluralLabel,
  tierOf,
  traceChain,
  type Filters,
  type Neighbourhood,
} from '../../src/graph/model';
import { layoutNeighbourhood } from '../../src/graph/layout';
import { addressOf, graphRedirect } from '../../src/views/address';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, testIndex } from './workspace';

const records = (n: Neighbourhood) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const groups = (n: Neighbourhood) => n.nodes.filter((x) => x.group).map((x) => x.id).sort();
const spine = (n: Neighbourhood) => n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });

describe('graph groups', () => {
  const index = testIndex();
  const grouped = indexWorkspace(groupedWorkspace());

  it('LA-BRW-T100 A record with several kinds of child, or more than a handful of one kind, has a group per child kind, labelled with the plural and a count', () => {
    expect(isGrouped(index, 'P-D')).toBe(true);
    expect(childKinds(index, 'P-D')).toEqual(['aggregate', 'use_case', 'view', 'endpoint', 'component', 'test', 'question']);
    // One kind, a handful or fewer: no groups.
    expect(isGrouped(index, 'P-D-UC01')).toBe(false);
    expect(isGrouped(index, 'P-D-A1')).toBe(false);
    expect(isGrouped(index, 'P')).toBe(false);
    // Six of one kind is more than a handful.
    expect(isGrouped(grouped, 'P-D-UC02')).toBe(true);
    expect(groupLabel(grouped, 'P-D-UC02/requirement')).toBe('Requirements (6)');
    expect(groupLabel(grouped, 'P-D/use_case')).toBe('Use cases (2)');
    expect(groupLabel(index, 'P-D/component')).toBe('Components (2)');
    expect(['question', 'domain_rule', 'domain'].map((k) => pluralLabel(index, k))).toEqual(['Open questions', 'Domain rules', 'Domains']);
    expect(groupMembers(index, 'P-D/component').map((r) => r.id)).toEqual(['P-D-C01', 'P-D-C02']);
    // A group is addressed by its parent and kind, and is not a record.
    expect(parseGroupId('P-D/use_case')).toEqual({ parent: 'P-D', kind: 'use_case' });
    expect(parseGroupId('P-D-UC01')).toBeNull();
    expect(parseGroupId('file:src/thing.ts')).toBeNull();
    expect(index.byId.has('P-D/use_case')).toBe(false);
    expect(isGraphNode(index, 'P-D/use_case')).toBe(true);
    expect(isGraphNode(index, 'P-D/flow')).toBe(false);
    expect(isGraphNode(index, 'missing/use_case')).toBe(false);
  });

  it('LA-BRW-T101 Groups are folded by default, open when the focus is a member or the person opens them, and the spine runs record, group, record', () => {
    const domain = neighbourhood(index, 'P-D', 1);
    expect(groups(domain)).toEqual(childKinds(index, 'P-D').map((k) => `P-D/${k}`).sort());
    expect(domain.nodes.filter((x) => x.group).every((x) => !x.group!.open)).toBe(true);
    // Folded: the domain's children are not shown, only its parent.
    expect(records(domain)).toEqual(['P', 'P-D']);
    expect(domain.nodes.find((x) => x.id === 'P-D/use_case')).toMatchObject({ title: 'Use cases (1)', distance: 1, group: { parent: 'P-D', count: 1, open: false } });
    // Opened by the person: its members appear, one step from the domain, behind the group.
    const opened = neighbourhood(index, 'P-D', 1, undefined, new Map([['P-D/use_case', true]]));
    expect(records(opened)).toEqual(['P', 'P-D', 'P-D-UC01']);
    expect(opened.nodes.find((x) => x.id === 'P-D-UC01')!.distance).toBe(1);
    expect(spine(opened)).toContain('P-D > P-D/use_case');
    expect(spine(opened)).toContain('P-D/use_case > P-D-UC01');
    expect(spine(opened)).not.toContain('P-D > P-D-UC01');
    // The focus's own group is open, so its siblings show; the person can close it.
    const uc = neighbourhood(grouped, 'P-D-UC01', 1);
    expect(records(uc)).toContain('P-D-UC02');
    expect(uc.nodes.find((x) => x.id === 'P-D/use_case')!.group!.open).toBe(true);
    expect(records(neighbourhood(grouped, 'P-D-UC01', 1, undefined, new Map([['P-D/use_case', false]])))).not.toContain('P-D-UC02');
    // A grouped record below the focus: its requirements stay folded.
    const uc2 = neighbourhood(grouped, 'P-D-UC02', 1);
    expect(groups(uc2)).toEqual(['P-D-UC02/requirement', 'P-D/use_case']);
    expect(records(uc2).filter((id) => id.startsWith('P-D-UC02-'))).toEqual([]);
    // Cross-links still go record to record.
    const req = neighbourhood(index, 'P-D-UC01-R01', 2);
    expect(req.edges.filter((e) => e.relation !== 'parent').every((e) => !parseGroupId(e.source) && !parseGroupId(e.target))).toBe(true);
    expect(req.edges.map((e) => e.id)).toContain('P-D-C01|satisfies|P-D-UC01-R01');
    // Groups do not count as a hop, so the same records are reached at the same distances as before.
    expect(neighbourhood(index, 'P-D-C01', 1).nodes.find((x) => x.id === 'P-D')!.distance).toBe(1);
  });

  it('LA-BRW-T102 A group can be the focus: its parent and all its members are shown', () => {
    const g = neighbourhood(grouped, 'P-D/use_case', 1);
    expect(g.nodes[0]).toMatchObject({ id: 'P-D/use_case', distance: 0 });
    expect(records(g)).toEqual(['P-D', 'P-D-UC01', 'P-D-UC02']);
    for (const e of ['P-D > P-D/use_case', 'P-D/use_case > P-D-UC01', 'P-D/use_case > P-D-UC02']) expect(spine(g)).toContain(e);
    // The parent's other groups and the members' own groups are shown folded, as context.
    expect(g.nodes.filter((x) => x.group && x.id !== 'P-D/use_case').every((x) => !x.group!.open)).toBe(true);
    // The focus group cannot be folded.
    expect(records(neighbourhood(grouped, 'P-D/use_case', 1, undefined, new Map([['P-D/use_case', false]])))).toContain('P-D-UC01');
    // A group that does not exist shows nothing.
    expect(neighbourhood(index, 'P-D/flow', 1).nodes).toEqual([]);
    // Its address.
    // Its address: /records/<parent-id>/<kind>, and the old /graph address leads there in the Graph view.
    expect(addressOf(grouped, 'P-D/use_case')).toBe('/records/P-D/use_case');
    expect(graphRedirect(grouped, '/graph/P-D/use_case')).toBe('/records/P-D/use_case?view=graph');
    expect(addressOf(grouped, 'P-D-UC01')).toBe('/records/P-D-UC01');
  });

  it('LA-BRW-T103 Groups take their own column between the parent and its children, left to right', async () => {
    expect(neighbourhood(index, 'P-D', 1).nodes.find((x) => x.id === 'P-D/use_case')!.tier).toBe(tierOf(index, 'use_case', 'hierarchy') - 0.5);
    const n = neighbourhood(grouped, 'P-D/use_case', 2);
    const { positions, layout } = await layoutNeighbourhood(n);
    expect(layout).toBe('layered');
    const x = (id: string) => positions.get(id)!.x;
    expect(x('P-D')).toBeLessThan(x('P-D/use_case'));
    expect(x('P-D/use_case')).toBeLessThan(x('P-D-UC01'));
    expect(x('P-D-UC01')).toBe(x('P-D-UC02'));
    expect(x('P-D-UC02')).toBeLessThan(x('P-D-UC02/requirement'));
    expect(x('P-D-UC02/requirement')).toBeLessThan(x('P-D-UC01-R01'));
    // Every group sits in a column of groups only.
    const columnOf = new Map<number, Set<boolean>>();
    for (const node of n.nodes) columnOf.set(x(node.id), (columnOf.get(x(node.id)) ?? new Set()).add(!!node.group));
    for (const kinds of columnOf.values()) expect(kinds.size).toBe(1);
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
    expect(groups(neighbourhood(index, 'P-D', 1, filters(['use_case'])))).not.toContain('P-D/use_case');
    expect(groups(neighbourhood(index, 'P-D', 1, filters([], ['parent'])))).toEqual([]);
    expect(groups(neighbourhood(index, 'P-D-UC01-R01', 2, filters([], ['parent'])))).toEqual([]);
    // The same graph every time.
    expect(neighbourhood(grouped, 'P-D-UC01', 2)).toEqual(neighbourhood(grouped, 'P-D-UC01', 2));
  });
});
