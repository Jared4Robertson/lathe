import { describe, expect, it } from 'vitest';
import { indexOf } from '../fixtures/load';
import {
  childKinds,
  groupLabel,
  groupMarks,
  groupMembers,
  isGraphNode,
  neighborhood,
  parseGroupId,
  PARENT,
  pluralLabel,
  traceChain,
  type Filters,
  type Neighborhood,
} from '../../src/graph/model';
import { graphMap } from '../../src/graph/map';
import { boxColors } from '../../src/graph/paint';
import { PLAIN_LOOK } from '../../src/graph/look';
import { addressOf } from '../../src/views/address';
import { groupedWorkspace, testIndex } from './workspace';

const ids = (n: Neighborhood) => n.nodes.map((x) => x.id).sort();
const groups = (n: Neighborhood) => n.nodes.filter((x) => x.group).map((x) => x.id).sort();
const records = (n: Neighborhood) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const spine = (n: Neighborhood) => n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });
const STAGES = ['P-D/domain-model', 'P-D/interaction-design', 'P-D/technical-specification', 'P-D/test-plan', 'P-D/use-cases'];

describe('graph groups', () => {
  const index = testIndex();
  const grouped = indexOf(groupedWorkspace());

  it.each(['LA-EXP-DS04-T01', 'LA-V93-R23-T01'])('%s A record with several kinds of child in its stage has a group per child kind, labeled with the plural and a count', () => {
    expect(childKinds(index, 'P-D')).toEqual(['aggregate', 'read_model', 'domain_service', 'term', 'capability', 'question']);
    // An aggregate with entities, invariants, events and commands reaches them through a group each.
    expect(groupLabel(index, 'P-D-A3/entity')).toBe('Entities (3)');
    expect(groupLabel(index, 'P-D-A3/command')).toBe('Commands (2)');
    // One kind of child: no groups. Shelf holds one entity until a command joins it.
    expect(isGraphNode(index, 'P-D-A4/entity')).toBe(false);
    expect(isGraphNode(grouped, 'P-D-A4/entity')).toBe(true);
    expect(groupLabel(grouped, 'P-D-A4/command')).toBe('Commands (1)');
    // Stages and folders are groups too.
    expect(groupLabel(index, 'P-D/technical-specification')).toBe('Technical specification (9)');
    expect(groupLabel(index, 'P-D/technical-specification/table')).toBe('Tables (3)');
    expect(['question', 'invariant', 'domain'].map((k) => pluralLabel(index, k))).toEqual(['Open questions', 'Invariants', 'Domains']);
    expect(groupMembers(index, 'P-D/technical-specification/table').map((r) => r.id)).toEqual(['P-D-EN02-TB', 'P-D-EN03-TB', 'P-D-RM01-TB']);
    // A group is addressed by its place in the tree, and is not a record.
    expect(parseGroupId('P-D-A3/entity')).toEqual({ parent: 'P-D-A3', kind: 'entity', path: [] });
    expect(parseGroupId('P-D/domain-model/aggregate')).toEqual({ parent: 'P-D', kind: 'domain-model', path: ['aggregate'] });
    expect(parseGroupId('P-D-UC01')).toBeNull();
    expect(parseGroupId('file:src/loans.ts')).toBeNull();
    expect(index.byId.has('P-D/domain-model')).toBe(false);
    expect(isGraphNode(index, 'P-D/domain-model')).toBe(true);
    // Only the tree's groups are groups: a parent and a kind outside it name nothing.
    expect(isGraphNode(index, 'P-D/use_case')).toBe(false);
    expect(isGraphNode(index, 'P-D-A1/invariant')).toBe(false);
    expect(isGraphNode(index, 'missing/use_case')).toBe(false);
  });

  it.each(['LA-EXP-DS05-T03', 'LA-V93-R23-T02'])('%s Every group is in the map with all its members beside it, and the spine runs record, group, record', () => {
    // At depth 1 the domain frames its five stages and the open questions' group; depth 2 frames their folders.
    const domain = neighborhood(index, 'P-D', 1);
    expect(groups(domain)).toEqual([...STAGES, 'P-D/question'].sort());
    expect(domain.nodes.find((x) => x.id === 'P-D/use-cases')).toMatchObject({ title: 'Use cases (1)', distance: 1, group: { parent: 'P-D', owner: 'P-D', count: 1 } });
    expect(groups(neighborhood(index, 'P-D', 2))).toEqual(expect.arrayContaining(['P-D/use-cases/capability', 'P-D/technical-specification/table']));
    // The spine runs through a group: the domain to its questions' group, the group to the question.
    const two = neighborhood(index, 'P-D', 2);
    expect(spine(two)).toContain('P-D > P-D/question');
    expect(spine(two)).toContain('P-D/question > P-D-Q01');
    expect(spine(two)).not.toContain('P-D > P-D-Q01');
    // In the map every group holds all its members, right beside it, and spans them exactly.
    const map = graphMap(grouped, 'P');
    for (const id of ['P-D/domain-model/aggregate', 'P-D-A3/entity', 'P-D-A4/command']) {
      const g = map.nodes.get(id)!;
      const members = g.children.map((c) => map.nodes.get(c)!);
      expect(members.map((m) => m.id)).toEqual(members.map((m) => m.id).filter((m) => map.nodes.get(m)!.parent === id));
      expect(members[0].y).toBeCloseTo(g.y, 6);
      expect(members.at(-1)!.y + members.at(-1)!.h).toBeCloseTo(g.y + g.h, 6);
    }
    expect(map.nodes.get('P-D-A3/entity')!.children).toHaveLength(3);
    // A record with two kinds of children reaches them through a group per kind.
    const shelf = neighborhood(grouped, 'P-D-A4', 1);
    expect(groups(shelf)).toEqual(['P-D-A4/command', 'P-D-A4/entity', 'P-D/domain-model/aggregate']);
    expect(records(shelf)).toEqual(['P-D-A4']);
    // Cross-links still go record to record.
    const step = neighborhood(index, 'P-D-UC01-FL-S01', 3, undefined, { links: true });
    expect(step.edges.filter((e) => e.relation !== 'parent').every((e) => !parseGroupId(e.source) && !parseGroupId(e.target))).toBe(true);
    expect(step.edges.map((e) => e.id)).toContain('P-D-UC01-FL-S01|fulfills|P-D-UC01-R01');
  });

  it('LA-V93-R10-T04 At depth 1 the graph frames the tree around the focus: its parent or folder at the left edge, its children or their groups, and no other links', () => {
    const at = (focus: string) => neighborhood(grouped, focus, 1);
    // A capability in its folder: the folder at the left edge, its use cases beside it; no siblings.
    expect(ids(at('P-D-CAP01'))).toEqual(['P-D-CAP01', 'P-D-UC01', 'P-D-UC02', 'P-D/use-cases/capability']);
    // A domain: its product, its stages and the open questions' group.
    expect(ids(at('P-D'))).toEqual(['P', 'P-D', ...STAGES, 'P-D/question'].sort());
    // A record with several kinds of children reaches them through their groups.
    expect(ids(at('P-D-A4'))).toEqual(['P-D-A4', 'P-D-A4/command', 'P-D-A4/entity', 'P-D/domain-model/aggregate']);
    // A leaf frames only itself and its parent.
    expect(ids(at('P-D-UC01-R01'))).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    for (const id of ['P-D-CAP01', 'P-D', 'P-D-UC01-R01']) expect(new Set(at(id).edges.map((e) => e.relation))).toEqual(new Set([PARENT]));
  });

  it.each(['LA-EXP-DS04-T02', 'LA-V93-R25-T01'])('%s A group can be the focus: its parent and all its members are shown, and depth counts levels from it', () => {
    const g = neighborhood(grouped, 'P-D/domain-model/aggregate', 1);
    expect(g.nodes[0]).toMatchObject({ id: 'P-D/domain-model/aggregate', distance: 0 });
    expect(ids(g)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4', 'P-D/domain-model', 'P-D/domain-model/aggregate']);
    for (const e of ['P-D/domain-model > P-D/domain-model/aggregate', 'P-D/domain-model/aggregate > P-D-A1', 'P-D/domain-model/aggregate > P-D-A4']) expect(spine(g)).toContain(e);
    // Depth 2 frames the members' own groups; depth 3 their members.
    const two = neighborhood(grouped, 'P-D/domain-model/aggregate', 2);
    expect(ids(two)).toEqual(expect.arrayContaining(['P-D-A3/entity', 'P-D-A4/command', 'P-D-A4/entity']));
    expect(ids(two)).not.toContain('P-D-EN03');
    expect(ids(neighborhood(grouped, 'P-D/domain-model/aggregate', 3))).toEqual(expect.arrayContaining(['P-D-EN03', 'P-D-CMD06']));
    // A group the tree does not have shows nothing.
    expect(neighborhood(index, 'P-D/flow', 2).nodes).toEqual([]);
    expect(neighborhood(grouped, 'P-D/use_case', 1).nodes).toEqual([]);
    // Its address: /<domain-id>/<stage>/<kind>.
    expect(addressOf('P-D/domain-model/aggregate')).toBe('/P-D/domain-model/aggregate');
    expect(addressOf('P-D/domain-model')).toBe('/P-D/domain-model');
    expect(addressOf('P-D-UC01')).toBe('/P-D-UC01');
  });

  it('LA-V93-R27-T01 Groups take their own column between the parent and its children, left to right', async () => {
    // A group is one column after its parent, and its members one column after the group.
    const column = (n: Neighborhood, id: string) => n.nodes.find((x) => x.id === id)!.column;
    const fromDomain = neighborhood(index, 'P-D', 3);
    expect(column(fromDomain, 'P-D/use-cases')).toBe(column(fromDomain, 'P-D') + 1);
    expect(column(fromDomain, 'P-D/use-cases/capability')).toBe(column(fromDomain, 'P-D/use-cases') + 1);
    expect(column(fromDomain, 'P-D-CAP01')).toBe(column(fromDomain, 'P-D/use-cases/capability') + 1);
    const n = neighborhood(grouped, 'P-D/domain-model/aggregate', 2);
    const map = graphMap(grouped, 'P');
    const x = (id: string) => map.nodes.get(id)!.x;
    expect(x('P-D/domain-model')).toBeLessThan(x('P-D/domain-model/aggregate'));
    expect(x('P-D/domain-model/aggregate')).toBeLessThan(x('P-D-A1'));
    expect(x('P-D-A1')).toBe(x('P-D-A4'));
    expect(x('P-D-A4')).toBeLessThan(x('P-D-A4/entity'));
    // An aggregate's group and a read model's ungrouped query are both one level below a folder's record: one level, each in its own parent's column.
    expect(map.nodes.get('P-D-A4/entity')!.level).toBe(map.nodes.get('P-D-QRY01')!.level);
    // Every group's column is one after its parent's and one before its members'.
    for (const g of n.nodes.filter((node) => node.group)) {
      if (g.id !== 'P-D/domain-model') expect(column(n, g.id)).toBe(column(n, g.group!.parent) + 1);
      for (const e of n.edges.filter((e) => e.source === g.id)) expect(column(n, e.target)).toBe(column(n, g.id) + 1);
    }
  });

  it('LA-V93-R26-T01 A group carries a summary mark when its members or anything beneath them has problems or coverage gaps', () => {
    // An invariant beneath an aggregate is not proved; a command's recorded exception is no problem, so it adds no mark.
    expect(groupMarks(index, 'P-D/domain-model/aggregate')).toEqual({ errors: 0, warnings: 1, gaps: ['proved'] });
    // A use case test has an error.
    expect(groupMarks(index, 'P-D/test-plan/use_case_test')).toEqual({ errors: 1, warnings: 0, gaps: [] });
    expect(groupMarks(grouped, 'P-D-A4/command')).toEqual({ errors: 0, warnings: 0, gaps: [] });
    // A group is a folder outlined in its stage's color; a group of no stage (open questions) in gray.
    expect(boxColors(PLAIN_LOOK, { file: false, group: true, kind: 'use_case_test', stage: 'test-plan' })).toEqual({ edge: PLAIN_LOOK.testPlanEdge, fill: PLAIN_LOOK.sheet });
    expect(boxColors(PLAIN_LOOK, { file: false, group: true, kind: 'question', stage: 'structural' })).toEqual({ edge: PLAIN_LOOK.muted, fill: PLAIN_LOOK.sheet });
  });

  it.each(['LA-EXP-DS05-T04', 'LA-V93-R23-T03'])('%s Trace mode has no groups, and filters hide groups with their kind or with the parent relation', () => {
    expect(traceChain(index, 'P-D-UC01-R01').nodes.some((x) => x.group)).toBe(false);
    // A kind group and a folder go with their kind; a stage has no kind of its own and stays.
    expect(ids(neighborhood(grouped, 'P-D-A4', 1, filters(['command'])))).not.toContain('P-D-A4/command');
    expect(ids(neighborhood(index, 'P-D', 1, filters(['question'])))).not.toContain('P-D/question');
    expect(ids(neighborhood(index, 'P-D', 2, filters(['capability'])))).not.toContain('P-D/use-cases/capability');
    expect(ids(neighborhood(index, 'P-D', 2, filters(['capability'])))).toContain('P-D/use-cases');
    expect(ids(neighborhood(index, 'P-D', 4, filters(['use_case'])))).not.toContain('P-D-UC01');
    expect(groups(neighborhood(index, 'P-D', 2, filters([], ['parent'])))).toEqual([]);
    expect(groups(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent'])))).toEqual([]);
    // The same graph every time.
    expect(neighborhood(grouped, 'P-D-UC01', 3)).toEqual(neighborhood(grouped, 'P-D-UC01', 3));
  });
});
