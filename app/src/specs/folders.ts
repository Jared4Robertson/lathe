import { plural } from '../plural';
import { byIdOrder, kindLabel, type SpecIndex, type SpecRecord } from './data';
import type { SectionRule } from '../../../lathe/src/types';

// The folders a product's records are read in, as S2 lays out its specs (FORMAT.md section 15):
// each domain has its stages (Define, Design) and in each stage its folders (Domain model, Use
// cases; Interaction design, Technical specification, Test plan); the product has its shared
// folders (Shared, holding the patterns). Labels and order come from the workspace's sections,
// never from here. Within a folder, records may sit in groups: Technical specification by the
// domain's layers, Test plan by what each test proves (computed, not stored). The side nav, the
// domain page and the group pages all read this one model, so they name and order things the same way.

export interface Folder {
  /** A stable key for remembering whether the folder is open: "DM-SHOP/define/use-cases". */
  key: string;
  /** The section's name, or "kind:<kind>" for the records of a kind that sits in no known folder. */
  section: string;
  label: string;
  description: string;
  /** The kinds the folder holds, in the meta-model's order. */
  kinds: string[];
  /** The records shown in the folder, kind by kind (capabilities in their order, the rest by ID). */
  records: SpecRecord[];
  /**
   * The folder's records in groups, when it has them: Technical specification by layer (when the
   * domain has layers) and Test plan by what each test proves. Empty when the folder lists its
   * records as they are.
   */
  groups: FolderGroup[];
  /** How many records the folder shows: those in its groups (components, tests), or else its records. */
  count: number;
}

/**
 * A group of a folder's records. A layer's group is the layer record itself, so its row links to
 * the layer's page; the test plan's groups are computed and are not records, so their rows only fold.
 */
export interface FolderGroup {
  /** A stable key for remembering whether the group is open: the folder's key and the group's own part. */
  key: string;
  label: string;
  /** The record the group is (a layer), or null for a group that is not a record. */
  record: SpecRecord | null;
  /** The groups within it (an acceptance group's capabilities and use cases), in their order. */
  groups: FolderGroup[];
  /** Its own records, in ID order. */
  records: SpecRecord[];
  /** The records in it and in every group within it. */
  count: number;
}

export interface StageFolders {
  key: string;
  stage: string;
  label: string;
  folders: Folder[];
  /** The records in all its folders. */
  count: number;
}

export interface DomainFolders {
  stages: StageFolders[];
  /** After the stages: the domain's records of kinds outside every stage, such as open questions. */
  loose: Folder[];
}

/** A stage's label, from its name: "define" -> "Define". */
export const stageLabel = (stage: string) => stage.charAt(0).toUpperCase() + stage.slice(1);

/** The workspace's sections, stage by stage in the order the stages first appear, each stage's folders in their order. */
function sectionsOf(index: SpecIndex): readonly SectionRule[] {
  const sections = index.workspace.sections ?? [];
  const stages = [...new Set(sections.map((s) => s.stage))];
  return [...sections].sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || a.order - b.order);
}

/** The folder a kind sits in, when it names one the workspace lists. */
export function sectionOfKind(index: SpecIndex, kind: string): SectionRule | null {
  const name = index.kinds.get(kind)?.section ?? '';
  return (name && sectionsOf(index).find((s) => s.section === name)) || null;
}

/** Where a kind sits, as headings: ["Define", "Use cases"], ["Shared"], or [] for a kind in no folder. */
export function folderPath(index: SpecIndex, kind: string): string[] {
  const section = sectionOfKind(index, kind);
  if (!section) {
    const stage = index.kinds.get(kind)?.stage ?? '';
    return stage ? [stageLabel(stage)] : [];
  }
  return section.stage ? [stageLabel(section.stage), section.label] : [section.label];
}

const order = (r: SpecRecord) => { const n = Number(r.fields.order); return Number.isInteger(n) ? n : Infinity; };
const kindRank = (index: SpecIndex) => {
  const ranks = new Map(index.workspace.kinds.map((k, i) => [k.kind, i]));
  return (kind: string) => ranks.get(kind) ?? Infinity;
};

/** Records kind by kind in the meta-model's order; capabilities (and anything with an order) in their order, then by ID. */
function sortRecords(index: SpecIndex, records: SpecRecord[]): SpecRecord[] {
  const rank = kindRank(index);
  return [...records].sort((a, b) => rank(a.kind) - rank(b.kind) || (a.kind === 'capability' ? order(a) - order(b) : 0) || byIdOrder(a, b));
}

/** Groups records into folders by their kind's section, in the order of `sections`, then one folder per kind in no known section. */
function fold(index: SpecIndex, keyPrefix: string, sections: readonly SectionRule[], records: SpecRecord[], unfiled: boolean): Folder[] {
  const rank = kindRank(index);
  const folders: Folder[] = [];
  for (const s of sections) {
    const inside = records.filter((r) => sectionOfKind(index, r.kind)?.section === s.section);
    const kinds = index.workspace.kinds.filter((k) => k.section === s.section).map((k) => k.kind);
    folders.push(withGroups(index, { key: `${keyPrefix}/${s.section}`, section: s.section, label: s.label, description: s.description, kinds, records: sortRecords(index, inside), groups: [], count: 0 }));
  }
  if (unfiled) {
    const rest = records.filter((r) => !sectionOfKind(index, r.kind));
    for (const kind of [...new Set(rest.map((r) => r.kind))].sort((a, b) => rank(a) - rank(b))) {
      folders.push(withGroups(index, {
        key: `${keyPrefix}/kind:${kind}`,
        section: `kind:${kind}`,
        label: plural(kindLabel(index, kind)),
        description: index.kinds.get(kind)?.description ?? '',
        kinds: [kind],
        records: sortRecords(index, rest.filter((r) => r.kind === kind)),
        groups: [],
        count: 0,
      }));
    }
  }
  return folders;
}

// ---- Groups within a folder ----

const groupOf = (key: string, label: string, records: SpecRecord[], groups: FolderGroup[] = [], record: SpecRecord | null = null): FolderGroup => ({
  key,
  label,
  record,
  groups,
  records: [...records].sort(byIdOrder),
  count: records.length + groups.reduce((n, g) => n + g.count, 0),
});

/** "Components outside any layer": a kind's plural label, outside any of another kind. */
export const outsideLabel = (index: SpecIndex, kind: string, outside: string) =>
  `${plural(kindLabel(index, kind))} outside any ${kindLabel(index, outside).toLowerCase()}`;

/**
 * A folder's records by layer: each layer in its order, holding its components, then the records
 * sitting directly in the domain ("Components outside any layer"). A folder with no layers has no groups.
 */
export function layerGroups(index: SpecIndex, keyPrefix: string, records: SpecRecord[]): FolderGroup[] {
  const layers = records.filter((r) => r.kind === 'layer').sort((a, b) => order(a) - order(b) || byIdOrder(a, b));
  if (layers.length === 0) return [];
  const groups = layers.map((layer) => groupOf(`${keyPrefix}/${layer.id}`, layer.title, index.children.get(layer.id) ?? [], [], layer));
  const outside = records.filter((r) => r.kind !== 'layer');
  if (outside.length > 0) groups.push(groupOf(`${keyPrefix}/outside`, outsideLabel(index, outside[0].kind, 'layer'), outside));
  return groups;
}

/** The test plan's groups, in order: a test goes in the first whose kind it proves; one that proves none of them is an engineering check. */
export const TEST_GROUPS = [
  { group: 'acceptance', label: 'Acceptance tests', proves: 'requirement' },
  { group: 'domain-rules', label: 'Domain rule tests', proves: 'domain_rule' },
  { group: 'patterns', label: 'Pattern tests', proves: 'pattern_rule' },
  { group: 'interaction', label: 'Interaction tests', proves: 'interaction_requirement' },
  { group: 'engineering', label: 'Engineering checks', proves: null },
] as const;

export type TestGroup = (typeof TEST_GROUPS)[number]['group'];

/** The records of one kind a test proves, in ID order. */
const provedOf = (index: SpecIndex, test: SpecRecord, kind: string) =>
  (index.outgoing.get(test.id) ?? [])
    .filter((l) => l.relation === 'proves')
    .map((l) => index.byId.get(l.target))
    .filter((r): r is SpecRecord => r?.kind === kind)
    .sort(byIdOrder);

/** The parents of the records of one kind a test proves (the use cases of its requirements, the patterns of its pattern rules), in ID order. */
const ownersOf = (index: SpecIndex, test: SpecRecord, kind: string) =>
  [...new Set(provedOf(index, test, kind).map((r) => r.parent ?? ''))]
    .map((id) => index.byId.get(id))
    .filter((r): r is SpecRecord => !!r)
    .sort(byIdOrder);

/** The test-plan group a test goes in: the first of TEST_GROUPS that applies. */
export function testGroupOf(index: SpecIndex, test: SpecRecord): TestGroup {
  for (const g of TEST_GROUPS) {
    if (g.proves === null) return g.group;
    // Acceptance and pattern tests are grouped by the use case or pattern they prove, so they need one.
    const owned = g.proves === 'requirement' || g.proves === 'pattern_rule';
    if (owned ? ownersOf(index, test, g.proves).length > 0 : provedOf(index, test, g.proves).length > 0) return g.group;
  }
  return 'engineering';
}

/**
 * Tests grouped by what they prove, computed and not stored: acceptance tests (by capability in
 * order, use cases outside any capability last, then by the first use case each proves, in ID
 * order), domain rule tests, pattern tests (by the first pattern each proves), interaction tests,
 * then engineering checks. An empty group is left out, and when only one group has tests, there is
 * no group level (what is within it stays). When none of the acceptance tests' use cases is in a
 * capability, the acceptance tests go straight into their use cases.
 */
export function testGroups(index: SpecIndex, keyPrefix: string, tests: SpecRecord[]): FolderGroup[] {
  const groups: FolderGroup[] = [];
  for (const g of TEST_GROUPS) {
    const members = tests.filter((t) => testGroupOf(index, t) === g.group);
    if (members.length === 0) continue;
    const key = `${keyPrefix}/${g.group}`;
    if (g.group === 'acceptance') groups.push(groupOf(key, g.label, [], acceptanceGroups(index, key, members)));
    else if (g.group === 'patterns') groups.push(groupOf(key, g.label, [], byOwner(index, key, members, 'pattern_rule')));
    else groups.push(groupOf(key, g.label, members));
  }
  // A split only appears when there is more than one group to tell apart: with one, its tests are
  // listed directly, or by the capabilities, use cases or patterns within it.
  return groups.length === 1 ? groups[0].groups : groups;
}

/** Tests by the first record owning what they prove of a kind (a use case, a pattern), owners in ID order. */
function byOwner(index: SpecIndex, keyPrefix: string, tests: SpecRecord[], kind: string): FolderGroup[] {
  const owners = new Map<string, { owner: SpecRecord; tests: SpecRecord[] }>();
  for (const t of tests) {
    const owner = ownersOf(index, t, kind)[0];
    const entry = owners.get(owner.id) ?? { owner, tests: [] };
    entry.tests.push(t);
    owners.set(owner.id, entry);
  }
  return [...owners.values()]
    .sort((a, b) => byIdOrder(a.owner, b.owner))
    .map(({ owner, tests: members }) => groupOf(`${keyPrefix}/${owner.id}`, owner.title, members));
}

/** Acceptance tests by capability in order, then use cases outside any capability, each by use case. */
function acceptanceGroups(index: SpecIndex, keyPrefix: string, tests: SpecRecord[]): FolderGroup[] {
  const capabilityOf = (t: SpecRecord) => {
    const useCase = ownersOf(index, t, 'requirement')[0];
    const parent = useCase.parent ? index.byId.get(useCase.parent) : undefined;
    return parent?.kind === 'capability' ? parent : null;
  };
  const capabilities = [...new Map(tests.map(capabilityOf).filter((c): c is SpecRecord => !!c).map((c) => [c.id, c])).values()]
    .sort((a, b) => order(a) - order(b) || byIdOrder(a, b));
  if (capabilities.length === 0) return byOwner(index, keyPrefix, tests, 'requirement');
  const groups = capabilities.map((c) => {
    const key = `${keyPrefix}/${c.id}`;
    return groupOf(key, c.title, [], byOwner(index, key, tests.filter((t) => capabilityOf(t)?.id === c.id), 'requirement'));
  });
  const outside = tests.filter((t) => !capabilityOf(t));
  if (outside.length > 0) {
    const key = `${keyPrefix}/outside`;
    groups.push(groupOf(key, outsideLabel(index, 'use_case', 'capability'), [], byOwner(index, key, outside, 'requirement')));
  }
  return groups;
}

const groupedIds = (groups: readonly FolderGroup[]): string[] => groups.flatMap((g) => [...g.records.map((r) => r.id), ...groupedIds(g.groups)]);

/** Gives a folder its groups and count: by layer when it holds layers, by what each test proves when it holds tests. */
function withGroups(index: SpecIndex, folder: Folder): Folder {
  const groups = folder.kinds.includes('layer') ? layerGroups(index, folder.key, folder.records)
    : folder.kinds.includes('test') ? testGroups(index, folder.key, folder.records.filter((r) => r.kind === 'test'))
    : [];
  if (groups.length === 0) return { ...folder, groups, count: folder.records.length };
  const grouped = { ...folder, groups };
  return { ...grouped, count: groups.reduce((n, g) => n + g.count, 0) + ungrouped(grouped).length };
}

/** A grouped folder's records that no group holds (none, unless a product adds another kind to the folder), listed after its groups. */
export function ungrouped(folder: Pick<Folder, 'groups' | 'records'>): SpecRecord[] {
  if (folder.groups.length === 0) return folder.records;
  const grouped = new Set([...groupedIds(folder.groups), ...folder.groups.flatMap((g) => (g.record ? [g.record.id] : []))]);
  return folder.records.filter((r) => !grouped.has(r.id));
}

/** The keys of the groups holding a record or one of the records above it, from the outside in. */
export function groupBranch(groups: readonly FolderGroup[], ids: ReadonlySet<string>): string[] {
  for (const g of groups) {
    if (g.record && ids.has(g.record.id)) return [g.key];
    const inner = groupBranch(g.groups, ids);
    if (inner.length > 0) return [g.key, ...inner];
    if (g.records.some((r) => ids.has(r.id))) return [g.key];
  }
  return [];
}

/**
 * The records a domain's folders show: its own children, and the children of its capabilities
 * that sit in another folder than capabilities do (a capability's flows and tests are listed in
 * Interaction design and Test plan; its use cases stay under it, so Use cases lists the
 * capabilities and then the use cases outside any capability).
 */
export function domainRecords(index: SpecIndex, domainId: string): SpecRecord[] {
  const direct = index.children.get(domainId) ?? [];
  const capabilitySection = (kind: string) => sectionOfKind(index, kind)?.section ?? `kind:${kind}`;
  const lifted = direct
    .filter((r) => r.kind === 'capability')
    .flatMap((c) => (index.children.get(c.id) ?? []).filter((r) => capabilitySection(r.kind) !== capabilitySection(c.kind)));
  return [...direct, ...lifted];
}

/** A domain's stages and folders, with every folder of each stage (empty ones too), then its records outside every stage. */
export function domainFolders(index: SpecIndex, domainId: string): DomainFolders {
  const records = domainRecords(index, domainId);
  const staged = sectionsOf(index).filter((s) => s.stage !== '');
  const stageNames = [...new Set([...staged.map((s) => s.stage), ...records.map((r) => index.kinds.get(r.kind)?.stage ?? '').filter(Boolean)])];
  const stages = stageNames.map((stage) => {
    const inStage = records.filter((r) => {
      const section = sectionOfKind(index, r.kind);
      return section ? section.stage === stage : (index.kinds.get(r.kind)?.stage ?? '') === stage;
    });
    const folders = fold(index, `${domainId}/${stage}`, staged.filter((s) => s.stage === stage), inStage, true);
    return { key: `${domainId}/${stage}`, stage, label: stageLabel(stage), folders, count: folders.reduce((n, f) => n + f.count, 0) };
  });
  // Outside every stage: kinds in no folder and of no stage, and kinds in a product-level folder.
  const loose = records.filter((r) => {
    const section = sectionOfKind(index, r.kind);
    return section ? section.stage === '' : !(index.kinds.get(r.kind)?.stage ?? '');
  });
  const shared = sectionsOf(index).filter((s) => s.stage === '');
  return { stages, loose: fold(index, domainId, shared, loose, true).filter((f) => f.records.length > 0) };
}

/** A product's own folders (those of no stage, such as Shared), each with the product's children of its kinds. */
export function productFolders(index: SpecIndex, productId: string): Folder[] {
  const children = index.children.get(productId) ?? [];
  const shared = sectionsOf(index).filter((s) => s.stage === '');
  return fold(index, productId, shared, children.filter((r) => sectionOfKind(index, r.kind)?.stage === ''), false);
}

/** The kinds a product's own folders hold (patterns), which are not also listed as the product's groups. */
export function productFolderKinds(index: SpecIndex): Set<string> {
  const shared = new Set(sectionsOf(index).filter((s) => s.stage === '').map((s) => s.section));
  return new Set(index.workspace.kinds.filter((k) => shared.has(k.section)).map((k) => k.kind));
}

/**
 * The keys of the nav rows that hold a record, from the outside in: its domain, stage and folder
 * (or the product's folder), so the current page's branch can open itself. A record below a listed
 * one (a requirement under its use case) opens the branch of the one listed.
 */
export function branchOf(index: SpecIndex, id: string): string[] {
  const record = index.byId.get(id);
  if (!record) return [];
  if (record.kind === 'product') return [];
  if (record.kind === 'domain') return [`domain:${record.id}`];
  const listedIn = (folders: Folder[]) => {
    for (let r: SpecRecord | undefined = record, seen = 0; r && seen < 64; r = r.parent ? index.byId.get(r.parent) : undefined, seen++) {
      const folder = folders.find((f) => f.records.some((x) => x.id === r!.id));
      if (folder) return folder;
    }
    return null;
  };
  if (record.domain) {
    const { stages, loose } = domainFolders(index, record.domain);
    // The nearest listed record wins: a capability's test is in Test plan, not under its capability.
    const folder = listedIn([...stages.flatMap((s) => s.folders), ...loose]);
    const stage = folder && stages.find((s) => s.folders.includes(folder));
    if (!folder) return [`domain:${record.domain}`];
    // Within a grouped folder, the groups holding the record (a component's layer, a test's groups).
    const above = new Set<string>();
    for (let r: SpecRecord | undefined = record; r && !above.has(r.id); r = r.parent ? index.byId.get(r.parent) : undefined) above.add(r.id);
    const groups = groupBranch(folder.groups, above);
    return stage ? [`domain:${record.domain}`, stage.key, folder.key, ...groups] : [`domain:${record.domain}`, folder.key, ...groups];
  }
  if (record.product) {
    const folder = listedIn(productFolders(index, record.product));
    return folder ? [folder.key] : [];
  }
  return [];
}

/** The branch of a group page: the folder holding its kind in its parent's domain, or its parent's own branch. */
export function groupBranchOf(index: SpecIndex, parent: string, kind: string): string[] {
  const record = index.byId.get(parent);
  if (record?.kind === 'domain') {
    const { stages, loose } = domainFolders(index, parent);
    for (const stage of stages) {
      const folder = stage.folders.find((f) => f.kinds.includes(kind));
      if (folder) return [`domain:${parent}`, stage.key, folder.key];
    }
    const folder = loose.find((f) => f.kinds.includes(kind));
    return folder ? [`domain:${parent}`, folder.key] : [`domain:${parent}`];
  }
  if (record?.kind === 'product') {
    const folder = productFolders(index, parent).find((f) => f.kinds.includes(kind));
    return folder ? [folder.key] : [];
  }
  return branchOf(index, parent);
}
