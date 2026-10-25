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

const ids = (n: Neighborhood) => n.nodes.map((x) => x.id).sort();
const groups = (n: Neighborhood) => n.nodes.filter((x) => x.group).map((x) => x.id).sort();
const focusOf = (n: Neighborhood) => n.nodes.filter((x) => !x.context).map((x) => x.id).sort();
const contextOf = (n: Neighborhood) => n.nodes.filter((x) => x.context).map((x) => x.id).sort();
const focusRecords = (n: Neighborhood) => n.nodes.filter((x) => !x.context && !x.group).map((x) => x.id).sort();
const focusGroups = (n: Neighborhood) => n.nodes.filter((x) => !x.context && x.group).map((x) => x.id).sort();
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

  it('LA-BRW-T101 Groups within the depth are open and those at its edge folded, the person can open or fold any, and the spine runs record, group, record', () => {
    // At depth 1 the domain's stages are folded: their folders are the faded ring.
    const domain = neighborhood(index, 'P-D', 1);
    expect(focusGroups(domain)).toEqual(['P-D/define', 'P-D/design', 'P-D/question']);
    expect(domain.nodes.filter((x) => x.group && !x.context).every((x) => !x.group!.open)).toBe(true);
    expect(domain.nodes.find((x) => x.id === 'P-D/define')).toMatchObject({ title: 'Define (2)', distance: 1, group: { parent: 'P-D', owner: 'P-D', count: 2, open: false } });
    expect(contextOf(domain)).toEqual(['P-D-Q01', 'P-D/define/domain-model', 'P-D/define/use-cases', 'P-D/design/interaction-design', 'P-D/design/technical-specification', 'P-D/design/test-plan']);
    // At depth 2 the stages are open and their folders folded.
    const two = neighborhood(index, 'P-D', 2);
    expect(two.nodes.find((x) => x.id === 'P-D/define')!.group!.open).toBe(true);
    expect(two.nodes.find((x) => x.id === 'P-D/define/use-cases')!.group!.open).toBe(false);
    // Opened by the person at the edge: its members join, in focus, behind the group.
    const opened = neighborhood(index, 'P-D', 1, undefined, new Map([['P-D/question', true]]));
    expect(focusRecords(opened)).toEqual(['P', 'P-D', 'P-D-Q01']);
    expect(spine(opened)).toContain('P-D > P-D/question');
    expect(spine(opened)).toContain('P-D/question > P-D-Q01');
    expect(spine(opened)).not.toContain('P-D > P-D-Q01');
    // Folded by the person within the depth: nothing beneath it, not even faded.
    const folded = neighborhood(index, 'P-D', 2, undefined, new Map([['P-D/define', false]]));
    expect(ids(folded).filter((id) => id.startsWith('P-D/define/'))).toEqual([]);
    // The focus's own folder stays folded, so its siblings do not crowd the picture; opening it brings them.
    const uc = neighborhood(grouped, 'P-D-UC01', 1);
    expect(uc.nodes.find((x) => x.id === 'P-D/define/use-cases')!.group!.open).toBe(false);
    expect(ids(uc)).not.toContain('P-D-UC02');
    expect(focusRecords(neighborhood(grouped, 'P-D-UC01', 1, undefined, new Map([['P-D/define/use-cases', true]])))).toContain('P-D-UC02');
    // A record with two kinds of children reaches them through a group per kind, folded at the edge.
    const uc2 = neighborhood(grouped, 'P-D-UC02', 1);
    expect(focusGroups(uc2)).toEqual(['P-D-UC02/question', 'P-D-UC02/requirement', 'P-D/define/use-cases']);
    expect(focusRecords(uc2)).toEqual(['P-D-UC02']);
    // Cross-links still go record to record.
    const req = neighborhood(index, 'P-D-UC01-R01', 3, undefined, undefined, { links: true });
    expect(req.edges.filter((e) => e.relation !== 'parent').every((e) => !parseGroupId(e.source) && !parseGroupId(e.target))).toBe(true);
    expect(req.edges.map((e) => e.id)).toContain('P-D-C01|satisfies|P-D-UC01-R01');
  });

  it('LA-BRW-T277 At depth 1 the graph is the tree around the focus: its parent or folder above, its children or their folders below, no other links, and the next level out faded', () => {
    const at = (focus: string, open?: Map<string, boolean>) => neighborhood(grouped, focus, 1, undefined, open);
    // A use case in a folder: the folder (folded, so no siblings) above, its requirement below; the stage above the folder is context.
    expect(focusOf(at('P-D-UC01'))).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D/define/use-cases']);
    expect(contextOf(at('P-D-UC01'))).toEqual(['P-D/define']);
    // A domain: its product above, its stages and the open questions below; their folders and questions faded.
    expect(focusOf(at('P-D'))).toEqual(['P', 'P-D', 'P-D/define', 'P-D/design', 'P-D/question']);
    expect(contextOf(at('P-D'))).toEqual(['P-D-Q01', 'P-D/define/domain-model', 'P-D/define/use-cases', 'P-D/design/interaction-design', 'P-D/design/technical-specification', 'P-D/design/test-plan']);
    // A record with several kinds of children reaches them through their groups; their members are faded.
    expect(focusOf(at('P-D-UC02'))).toEqual(['P-D-UC02', 'P-D-UC02/question', 'P-D-UC02/requirement', 'P-D/define/use-cases']);
    expect(contextOf(at('P-D-UC02'))).toEqual(['P-D-UC02-Q01', 'P-D-UC02-R01', 'P-D-UC02-R02', 'P-D-UC02-R03', 'P-D-UC02-R04', 'P-D-UC02-R05', 'P-D-UC02-R06', 'P-D/define']);
    // A leaf shows only its parent, and its parent's folder faded.
    expect(focusOf(at('P-D-UC01-R01'))).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    for (const id of ['P-D-UC01', 'P-D', 'P-D-UC01-R01']) expect(new Set(at(id).edges.map((e) => e.relation))).toEqual(new Set([PARENT]));
    // A folder opened here shows its members, siblings included.
    expect(focusOf(at('P-D-UC01', new Map([['P-D/define/use-cases', true]])))).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D-UC02', 'P-D/define/use-cases']);
  });

  it('LA-BRW-T102 A group can be the focus: its parent and all its members are shown, and depth counts levels from it', () => {
    const g = neighborhood(grouped, 'P-D/define/use-cases', 1);
    expect(g.nodes[0]).toMatchObject({ id: 'P-D/define/use-cases', distance: 0 });
    expect(focusOf(g)).toEqual(['P-D-UC01', 'P-D-UC02', 'P-D/define', 'P-D/define/use-cases']);
    for (const e of ['P-D/define > P-D/define/use-cases', 'P-D/define/use-cases > P-D-UC01', 'P-D/define/use-cases > P-D-UC02']) expect(spine(g)).toContain(e);
    // One level each way: the members' own children and the stage's domain are the faded ring.
    expect(contextOf(g)).toEqual(['P-D', 'P-D-UC01-R01', 'P-D-UC02/question', 'P-D-UC02/requirement']);
    // Depth 2 brings them into focus, the members' groups folded, with the next level faded.
    const two = neighborhood(grouped, 'P-D/define/use-cases', 2);
    expect(focusOf(two)).toEqual(expect.arrayContaining(['P-D', 'P-D-UC01-R01', 'P-D-UC02/question', 'P-D-UC02/requirement']));
    expect(two.nodes.filter((x) => x.group && x.id.startsWith('P-D-UC02/')).every((x) => !x.group!.open && !x.context)).toBe(true);
    expect(contextOf(two)).toEqual(expect.arrayContaining(['P', 'P-D-UC02-R01', 'P-D-UC02-Q01']));
    // The focus group cannot be folded.
    expect(focusOf(neighborhood(grouped, 'P-D/define/use-cases', 1, undefined, new Map([['P-D/define/use-cases', false]])))).toContain('P-D-UC01');
    // A group that does not exist shows nothing; an older kind group's address still works.
    expect(neighborhood(index, 'P-D/flow', 2).nodes).toEqual([]);
    expect(focusOf(neighborhood(grouped, 'P-D/use_case', 1))).toEqual(['P-D', 'P-D-UC01', 'P-D-UC02', 'P-D/use_case']);
    // Its address: /<domain-id>/<stage>/<folder>, and the old /graph address leads there in the Graph view.
    expect(addressOf(grouped, 'P-D/define/use-cases')).toBe('/P-D/define/use-cases');
    expect(addressOf(grouped, 'P-D/define')).toBe('/P-D/define');
    expect(legacyAddress('/graph/P-D/define/use-cases')).toBe('/P-D/define/use-cases?view=graph');
    expect(addressOf(grouped, 'P-D/use_case')).toBe('/P-D/use_case');
    expect(addressOf(grouped, 'P-D-UC01')).toBe('/P-D-UC01');
  });

  it('LA-BRW-T103 Groups take their own column between the parent and its children, left to right', async () => {
    // A group is one column after its parent, and its members one column after the group.
    const column = (n: Neighborhood, id: string) => n.nodes.find((x) => x.id === id)!.column;
    const fromDomain = neighborhood(index, 'P-D', 2, undefined, new Map([['P-D/define/use-cases', true]]));
    expect(column(fromDomain, 'P-D/define')).toBe(column(fromDomain, 'P-D') + 1);
    expect(column(fromDomain, 'P-D/define/use-cases')).toBe(column(fromDomain, 'P-D/define') + 1);
    expect(column(fromDomain, 'P-D-UC01')).toBe(column(fromDomain, 'P-D/define/use-cases') + 1);
    const n = neighborhood(grouped, 'P-D/define/use-cases', 2);
    const { positions } = layoutNeighborhood(n);
    const x = (id: string) => positions.get(id)!.x;
    expect(x('P-D/define')).toBeLessThan(x('P-D/define/use-cases'));
    expect(x('P-D/define/use-cases')).toBeLessThan(x('P-D-UC01'));
    expect(x('P-D-UC01')).toBe(x('P-D-UC02'));
    expect(x('P-D-UC02')).toBeLessThan(x('P-D-UC02/requirement'));
    // UC02's group and UC01's ungrouped requirement are both one level below a use case, so they share a column.
    expect(x('P-D-UC02/requirement')).toBe(x('P-D-UC01-R01'));
    // Every group's column is one after its parent's and one before its members'.
    for (const g of n.nodes.filter((node) => node.group)) {
      if (g.id !== 'P-D/define') expect(column(n, g.id)).toBe(column(n, g.group!.parent) + 1);
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
    // A kind group goes with its kind; a stage or a named folder has no kind of its own and stays.
    expect(ids(neighborhood(grouped, 'P-D-UC02', 1, filters(['requirement'])))).not.toContain('P-D-UC02/requirement');
    expect(ids(neighborhood(index, 'P-D', 1, filters(['question'])))).not.toContain('P-D/question');
    expect(ids(neighborhood(index, 'P-D', 2, filters(['use_case'])))).toContain('P-D/define/use-cases');
    expect(ids(neighborhood(index, 'P-D', 3, filters(['use_case'])))).not.toContain('P-D-UC01');
    expect(groups(neighborhood(index, 'P-D', 2, filters([], ['parent'])))).toEqual([]);
    expect(groups(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent'])))).toEqual([]);
    // The same graph every time.
    expect(neighborhood(grouped, 'P-D-UC01', 3)).toEqual(neighborhood(grouped, 'P-D-UC01', 3));
  });
});
