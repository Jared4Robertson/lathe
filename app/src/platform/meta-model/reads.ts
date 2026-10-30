import type { MetaKind, MetaModel, MetaRelation, MetaStage } from '../../../../lathe/src/platform/meta-model/read-model';
import type { ColumnDescription } from '../../../../lathe/src/platform/data/schema';
import { useRead, type Read } from '../../record/read';

export type { MetaKind, MetaModel, MetaRelation, MetaStage };

// The Meta model read (LA-PLT-RM08, get-meta-model): every kind with its label, stage and parents, the six stages, the
// relations' pairs with their words both ways, and each table's columns. Every page names a kind, places it in its stage,
// words a link and draws a field from it, never from a record's row.

/** The workspace's meta model: read again whenever the data is (`version`). */
export const useMetaModel = (version: unknown): Read<MetaModel> => useRead<MetaModel>('/api/meta-model/get-meta-model', {}, version);

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
