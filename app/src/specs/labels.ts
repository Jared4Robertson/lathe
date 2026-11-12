import { type MetaRelation } from '../platform/meta-model/reads';
import { compareIds, type RecordIndex, type SummaryLink } from '../exploring/record-summaries/record-index';
import { COLUMN_LINKS } from '../../../lathe/src/exploring/record-summaries/column-links';

// The words a link is shown by (LA-PAT-RECORD-PAGE-R07): each relation rule's `forward_label`, read from the
// link's source ("Fulfills"), and `reverse_label`, read from its target ("Fulfilled by"), from
// the schema's relations, or a column reference's drawn as a link (COLUMN_LINKS: a use case's Result, Result of).
// Every page that shows a link reads them from here, never the relation's code, so the wiki, the graph and the ERD
// view say the same thing.

type Rules = readonly MetaRelation[];

/** The relation rule a link follows: the one for its source and target kinds, or a `*` target. */
export function ruleFor(rules: Rules, relation: string, sourceKind: string | undefined, targetKind: string | undefined): MetaRelation | undefined {
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
  const rule = rules.find((r) => r.relation === relation) ?? COLUMN_LINKS.find((c) => c.relation === relation);
  return (from === 'source' ? rule?.forward_label : rule?.reverse_label)?.trim() || codeWords(relation);
}

/** The words for one link, read from its source (`source`: "Fulfills") or its target (`target`: "Fulfilled by"). */
export function linkLabel(index: RecordIndex, link: Pick<SummaryLink, 'source' | 'relation' | 'target'>, from: 'source' | 'target'): string {
  const rule = ruleFor(index.meta.relations, link.relation, index.byId.get(link.source)?.kind, index.byId.get(link.target)?.kind) ?? COLUMN_LINKS.find((c) => c.relation === link.relation);
  return (from === 'source' ? rule?.forward_label : rule?.reverse_label)?.trim() || codeWords(link.relation);
}

/** Links grouped by their label, read from one end, groups and IDs in order; each ID listed once per group. */
export function groupByLabel(index: RecordIndex, links: readonly SummaryLink[], from: 'source' | 'target'): { label: string; ids: string[] }[] {
  const groups = new Map<string, Set<string>>();
  for (const l of links) {
    const label = linkLabel(index, l, from);
    const other = from === 'source' ? l.target : l.source;
    groups.set(label, (groups.get(label) ?? new Set()).add(other));
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, ids]) => ({ label, ids: [...ids].sort(compareIds) }));
}
