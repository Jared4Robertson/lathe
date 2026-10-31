import { lowerLabel } from '../../plural';
import type { MetaKind, MetaModel, MetaRelation, MetaStage } from '../../../../lathe/src/platform/meta-model/read-model';
import type { ColumnDescription } from '../../../../lathe/src/platform/data/schema';

export type { MetaKind, MetaModel, MetaRelation, MetaStage };

// The Meta model read (LA-PLT-RM08, get-meta-model): every kind with its label, stage and parents, the six stages, the
// relations' pairs with their words both ways, and each table's columns. Every page names a kind, places it in its stage,
// words a link and draws a field from it, never from a record's row.

/** The meta model as pages look it up: each kind by name, in reading order, the stages, the relations and the columns. */
export interface MetaIndex {
  kinds: Map<string, MetaKind>;
  /** Every kind in reading order. */
  kindList: MetaKind[];
  stages: MetaStage[];
  relations: MetaRelation[];
  columns: Record<string, ColumnDescription[]>;
}

export function indexMetaModel(model: MetaModel): MetaIndex {
  return { kinds: new Map(model.kinds.map((k) => [k.kind, k])), kindList: model.kinds, stages: model.stages, relations: model.relations, columns: model.columns };
}

/** A kind's name inside a sentence (lowerLabel of its label): "view requirement", "UC requirement". */
export const kindWord = (meta: MetaIndex, kind: string): string => lowerLabel(meta.kinds.get(kind)?.label ?? kind.replaceAll('_', ' '));

/** The kinds among `within` whose records sit directly under a record of `kind`, in `within`'s order (the order the editor offers them). */
export function addedUnder<K extends string>(meta: MetaIndex, kind: string, within: readonly K[]): K[] {
  return within.filter((k) => meta.kinds.get(k)?.parent_kinds.includes(kind));
}
