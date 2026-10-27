import type { RelationRule, SpecLink } from '../../../lathe/src/types';
import type { SpecIndex } from './data';

// The words a link is shown by (LA-EXP-V03-R07): each relation rule's `forward_label`, read from the
// link's source ("Satisfies"), and `reverse_label`, read from its target ("Designed by"), from
// the schema's relations. Every page that shows a link reads them from here, never the relation's
// code, so the wiki, the side bar, the graph and the Model view say the same thing.

type Rules = readonly RelationRule[];

/** The relation rule a link follows: the one for its source and target kinds, or a `*` target. */
export function ruleFor(rules: Rules, relation: string, sourceKind: string | undefined, targetKind: string | undefined): RelationRule | undefined {
  return rules.find((r) => r.relation === relation && r.source_kind === sourceKind && r.target_kind === targetKind)
    ?? rules.find((r) => r.relation === relation && r.source_kind === sourceKind && r.target_kind === '*')
    ?? rules.find((r) => r.relation === relation);
}

/** The relation's code in words, for a relation with no rule (or a rule with no label yet). */
const codeWords = (relation: string) => {
  const words = relation.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A relation's label by its code alone, read from the source or the target: for legends and filters. */
export function relationLabelOf(rules: Rules, relation: string, from: 'source' | 'target' = 'source'): string {
  const rule = rules.find((r) => r.relation === relation);
  return (from === 'source' ? rule?.forward_label : rule?.reverse_label)?.trim() || codeWords(relation);
}

/** The words for one link, read from its source (`source`: "Satisfies") or its target (`target`: "Designed by"). */
export function linkLabel(index: SpecIndex, link: Pick<SpecLink, 'source' | 'relation' | 'target'>, from: 'source' | 'target'): string {
  const rule = ruleFor(index.workspace.relations, link.relation, index.byId.get(link.source)?.kind, index.byId.get(link.target)?.kind);
  return (from === 'source' ? rule?.forward_label : rule?.reverse_label)?.trim() || codeWords(link.relation);
}

/** A link's role in coverage ('design', 'proof' or ''), from its relation rule. */
export function roleOf(index: SpecIndex, link: Pick<SpecLink, 'source' | 'relation' | 'target'>): RelationRule['role'] {
  const source = index.byId.get(link.source)?.kind;
  const target = index.byId.get(link.target)?.kind;
  const rule = index.workspace.relations.find((r) =>
    r.relation === link.relation && r.source_kind === source && (r.target_kind === target || r.target_kind === '*'));
  return rule?.role ?? '';
}

/** Links grouped by their label, read from one end, groups and IDs in order; each ID listed once per group. */
export function groupByLabel(index: SpecIndex, links: readonly SpecLink[], from: 'source' | 'target'): { label: string; ids: string[] }[] {
  const groups = new Map<string, Set<string>>();
  for (const l of links) {
    const label = linkLabel(index, l, from);
    const other = from === 'source' ? l.target : l.source;
    groups.set(label, (groups.get(label) ?? new Set()).add(other));
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, ids]) => ({ label, ids: [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) }));
}
