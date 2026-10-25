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
import { graphMap } from '../../src/graph/map';
import { addressOf } from '../../src/views/address';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, testIndex } from './workspace';

const ids = (n: Neighborhood) => n.nodes.map((x) => x.id).sort();
const groups = (n: Neighborhood) => n.nodes.filter((x) => x.group).map((x) => x.id).sort();
const records = (n: Neighborhood) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const spine = (n: Neighborhood) => n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });

describe('graph groups', () => {
  const index = testIndex();
  const grouped = indexWorkspace(groupedWorkspace());

  it('LA-EXP-T27 A record with several kinds of child has a group per child kind, labeled with the plural and a count', () => {
    expect(isGrouped(index, 'P-D')).toBe(true);
    expect(childKinds(index, 'P-D')).toEqual(['aggregate', 'use_case', 'view', 'endpoint', 'component', 'test', 'question']);
    // One kind of child: no groups.
    expect(isGrouped(index, 'P-D-UC01')).toBe(false);
    expect(isGrouped(index, 'P-D-A1')).toBe(false);
    expect(isGrouped(index, 'P')).toBe(false);
    // Requirements and a question are two kinds.
    expect(isGrouped(grouped, 'P-D-UC02')).toBe(true);
    expect(groupLabel(grouped, 'P-D-UC02/requirement')).toBe('UC requirements (6)');
    expect(groupLabel(index, 'P-D/design/technical-specification')).toBe('Technical specification (2)');
    expect(['question', 'domain_rule', 'domain'].map((k) => pluralLabel(index, k))).toEqual(['Open questions', 'Domain rules', 'Domains']);
    expect(groupMembers(index, 'P-D/design/technical-specification').map((r) => r.id)).toEqual(['P-D-C01', 'P-D-C02']);
    // A group is addressed by its place in the tree, and is not a record.
    expect(parseGroupId('P-D-UC02/requirement')).toEqual({ parent: 'P-D-UC02', kind: 'requirement', path: [] });
    expect(parseGroupId('P-D-UC01')).toBeNull();
    expect(parseGroupId('file:src/thing.ts')).toBeNull();
    expect(index.byId.has('P-D/define')).toBe(false);
    expect(isGraphNode(index, 'P-D/define')).toBe(true);
    // Only the tree's groups are groups: a parent and a kind outside it name nothing.
    expect(isGraphNode(index, 'P-D/use_case')).toBe(false);
    expect(isGraphNode(index, 'P-D/flow')).toBe(false);
    expect(isGraphNode(index, 'missing/use_case')).toBe(false);
  });

  it('LA-EXP-T28 Every group is in the map with all its members beside it, and the spine runs record, group, record', () => {
    // At depth 1 the domain frames its stages and the open questions' group; depth 2 frames their folders.
    const domain = neighborhood(index, 'P-D', 1);
    expect(groups(domain)).toEqual(['P-D/define', 'P-D/design', 'P-D/question']);
    expect(domain.nodes.find((x) => x.id === 'P-D/define')).toMatchObject({ title: 'Define (2)', distance: 1, group: { parent: 'P-D', owner: 'P-D', count: 2 } });
    expect(groups(neighborhood(index, 'P-D', 2))).toEqual(expect.arrayContaining(['P-D/define/use-cases', 'P-D/design/technical-specification']));
    // The spine runs through a group: the domain to its questions' group, the group to the question.
    const two = neighborhood(index, 'P-D', 2);
    expect(spine(two)).toContain('P-D > P-D/question');
    expect(spine(two)).toContain('P-D/question > P-D-Q01');
    expect(spine(two)).not.toContain('P-D > P-D-Q01');
    // In the map every group holds all its members, right beside it, and spans them exactly.
    const map = graphMap(grouped);
    for (const id of ['P-D/define/use-cases', 'P-D-UC02/requirement', 'P-D-UC02/question']) {
      const g = map.nodes.get(id)!;
      const members = g.children.map((c) => map.nodes.get(c)!);
      expect(members.map((m) => m.id)).toEqual(members.map((m) => m.id).filter((m) => map.nodes.get(m)!.parent === id));
      expect(members[0].y).toBe(g.y);
      expect(members.at(-1)!.y + members.at(-1)!.h).toBe(g.y + g.h);
    }
    expect(map.nodes.get('P-D-UC02/requirement')!.children).toHaveLength(6);
    // A record with two kinds of children reaches them through a group per kind.
    const uc2 = neighborhood(grouped, 'P-D-UC02', 1);
    expect(groups(uc2)).toEqual(['P-D-UC02/question', 'P-D-UC02/requirement', 'P-D/define/use-cases']);
    expect(records(uc2)).toEqual(['P-D-UC02']);
    // Cross-links still go record to record.
    const req = neighborhood(index, 'P-D-UC01-R01', 3, undefined, { links: true });
    expect(req.edges.filter((e) => e.relation !== 'parent').every((e) => !parseGroupId(e.source) && !parseGroupId(e.target))).toBe(true);
    expect(req.edges.map((e) => e.id)).toContain('P-D-C01|satisfies|P-D-UC01-R01');
  });

  it('LA-EXP-T92 At depth 1 the graph frames the tree around the focus: its parent or folder at the left edge, its children or their folders, and no other links', () => {
    const at = (focus: string) => neighborhood(grouped, focus, 1);
    // A use case in a folder: the folder at the left edge, its requirement beside it; no siblings.
    expect(ids(at('P-D-UC01'))).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D/define/use-cases']);
    // A domain: its product, its stages and the open questions' group.
    expect(ids(at('P-D'))).toEqual(['P', 'P-D', 'P-D/define', 'P-D/design', 'P-D/question']);
    // A record with several kinds of children reaches them through their groups.
    expect(ids(at('P-D-UC02'))).toEqual(['P-D-UC02', 'P-D-UC02/question', 'P-D-UC02/requirement', 'P-D/define/use-cases']);
    // A leaf frames only itself and its parent.
    expect(ids(at('P-D-UC01-R01'))).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    for (const id of ['P-D-UC01', 'P-D', 'P-D-UC01-R01']) expect(new Set(at(id).edges.map((e) => e.relation))).toEqual(new Set([PARENT]));
  });

  it('LA-EXP-T29 A group can be the focus: its parent and all its members are shown, and depth counts levels from it', () => {
    const g = neighborhood(grouped, 'P-D/define/use-cases', 1);
    expect(g.nodes[0]).toMatchObject({ id: 'P-D/define/use-cases', distance: 0 });
    expect(ids(g)).toEqual(['P-D-UC01', 'P-D-UC02', 'P-D/define', 'P-D/define/use-cases']);
    for (const e of ['P-D/define > P-D/define/use-cases', 'P-D/define/use-cases > P-D-UC01', 'P-D/define/use-cases > P-D-UC02']) expect(spine(g)).toContain(e);
    // Depth 2 frames the members' own children and groups; depth 3 their members.
    const two = neighborhood(grouped, 'P-D/define/use-cases', 2);
    expect(ids(two)).toEqual(expect.arrayContaining(['P-D-UC01-R01', 'P-D-UC02/question', 'P-D-UC02/requirement']));
    expect(ids(two)).not.toContain('P-D-UC02-R01');
    expect(ids(neighborhood(grouped, 'P-D/define/use-cases', 3))).toEqual(expect.arrayContaining(['P-D-UC02-R01', 'P-D-UC02-Q01']));
    // A group the tree does not have shows nothing.
    expect(neighborhood(index, 'P-D/flow', 2).nodes).toEqual([]);
    expect(neighborhood(grouped, 'P-D/use_case', 1).nodes).toEqual([]);
    // Its address: /<domain-id>/<stage>/<folder>.
    expect(addressOf('P-D/define/use-cases')).toBe('/P-D/define/use-cases');
    expect(addressOf('P-D/define')).toBe('/P-D/define');
    expect(addressOf('P-D-UC01')).toBe('/P-D-UC01');
  });

  it('LA-EXP-T30 Groups take their own column between the parent and its children, left to right', async () => {
    // A group is one column after its parent, and its members one column after the group.
    const column = (n: Neighborhood, id: string) => n.nodes.find((x) => x.id === id)!.column;
    const fromDomain = neighborhood(index, 'P-D', 3);
    expect(column(fromDomain, 'P-D/define')).toBe(column(fromDomain, 'P-D') + 1);
    expect(column(fromDomain, 'P-D/define/use-cases')).toBe(column(fromDomain, 'P-D/define') + 1);
    expect(column(fromDomain, 'P-D-UC01')).toBe(column(fromDomain, 'P-D/define/use-cases') + 1);
    const n = neighborhood(grouped, 'P-D/define/use-cases', 2);
    const map = graphMap(grouped);
    const x = (id: string) => map.nodes.get(id)!.x;
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

  it('LA-EXP-T31 A group carries a summary mark when its members or anything beneath them has problems or coverage gaps', () => {
    // The rules beneath the aggregate are not proved, and one is not satisfied.
    expect(groupMarks(index, 'P-D/define/domain-model')).toEqual({ errors: 0, warnings: 3, gaps: ['proves', 'satisfies'] });
    // The test has an error.
    expect(groupMarks(index, 'P-D/design/test-plan')).toEqual({ errors: 1, warnings: 0, gaps: [] });
    expect(groupMarks(grouped, 'P-D-UC02/question')).toEqual({ errors: 0, warnings: 0, gaps: [] });
  });

  it('LA-EXP-T32 Trace mode has no groups, and filters hide groups with their kind or with the parent relation', () => {
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
