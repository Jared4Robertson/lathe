import { plural } from '../plural';
import { byIdOrder, kindLabel, type SpecIndex, type SpecRecord } from './data';
import type { SectionRule } from '../../../lathe/src/types';

// The folders a product's records are read in, as Client lays out its specs (FORMAT.md section 15):
// each domain has its stages (Define, Design) and in each stage its folders (Domain model, Use
// cases; Interaction design, Technical specification, Test plan); the product has its shared
// folders (Shared, holding the patterns). Labels and order come from the workspace's sections,
// never from here. The side nav, the domain page and the group pages all read this one model,
// so they name and order things the same way.

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
    folders.push({ key: `${keyPrefix}/${s.section}`, section: s.section, label: s.label, description: s.description, kinds, records: sortRecords(index, inside) });
  }
  if (unfiled) {
    const rest = records.filter((r) => !sectionOfKind(index, r.kind));
    for (const kind of [...new Set(rest.map((r) => r.kind))].sort((a, b) => rank(a) - rank(b))) {
      folders.push({
        key: `${keyPrefix}/kind:${kind}`,
        section: `kind:${kind}`,
        label: plural(kindLabel(index, kind)),
        description: index.kinds.get(kind)?.description ?? '',
        kinds: [kind],
        records: sortRecords(index, rest.filter((r) => r.kind === kind)),
      });
    }
  }
  return folders;
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
    return { key: `${domainId}/${stage}`, stage, label: stageLabel(stage), folders, count: folders.reduce((n, f) => n + f.records.length, 0) };
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
    return stage ? [`domain:${record.domain}`, stage.key, folder.key] : [`domain:${record.domain}`, folder.key];
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
