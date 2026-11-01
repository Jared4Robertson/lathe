// The Meta model read model (LA-PLT-RM08), shaped for the app: Lathe's kinds (with each product's own) in the order
// people read them, the six stages, every pair of kinds each relation may link with its labels both ways, and each
// table's columns as its fields' inputs take them. It is what the schema declares, never the rows: every page names a
// kind by its label, places it in its stage, words a link by its relation's labels and draws a field by its column.
// The projection is the only code that reads the schema for the query, and the only code that writes the table.
import type { ReadView } from '../data/rules.ts';
import type { ColumnDescription, Complexity, IdScope, Stage } from '../data/schema.ts';

/** One kind. */
export interface MetaKind {
  kind: string;
  label: string;
  /** Its stage, or null for a kind outside the stages (the product, an open question). */
  stage: Stage | null;
  /** Its place in the order people read kinds; null for a product's own kind, which follows Lathe's by name. */
  position: number | null;
  /** The kinds its records may sit under, in its parent columns' order. */
  parent_kinds: string[];
  /** Its parent columns, one per parent kind. */
  parent_columns: string[];
  obligation: boolean;
  /** essential, accidental, as-parent (as the record above it: a test, a standard rule) or by-type (a standard); null for an open question. */
  complexity: Complexity | null;
  id_scope: IdScope | null;
  /** The product that declares it, or null for Lathe's own. */
  declared_by: string | null;
  description: string;
}

/** One stage. */
export interface MetaStage {
  stage: Stage;
  position: number;
  label: string;
  description: string;
}

/** One pair of kinds a relation may link, with the link's words read from each end. */
export interface MetaRelation {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  /** 'design', 'build', 'proof', or '' for a link that is none of these. */
  role: 'design' | 'build' | 'proof' | '';
  description: string;
  /** Read from the source: "Fulfills". */
  forward_label: string;
  /** Read from the target: "Fulfilled by". */
  reverse_label: string;
}

/** The meta model as the app reads it. */
export interface MetaModel {
  /** Every kind, Lathe's by position, then each product's own by name. */
  kinds: MetaKind[];
  stages: MetaStage[];
  relations: MetaRelation[];
  /** Each table's columns, by table (every table but the link tables): a kind's, a part table's, a declaration's, a check's. */
  columns: Record<string, ColumnDescription[]>;
}

/** The read model's table, kept in memory: the one meta model. */
export interface MetaModelTable {
  model: MetaModel;
}

/** The projection: the read model's table, from the schema on each read (in memory; nothing keeps it). */
export function metaModelTableFrom(view: ReadView): MetaModelTable {
  const { schema } = view;
  const rank = (k: string) => schema.kinds[k].position ?? Number.MAX_SAFE_INTEGER;
  const kinds = Object.keys(schema.kinds)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((name): MetaKind => {
      const k = schema.kinds[name];
      return {
        kind: name,
        label: k.label,
        stage: k.stage,
        position: k.position,
        parent_kinds: k.parents.map((p) => p.kind),
        parent_columns: k.parents.map((p) => p.column),
        obligation: k.obligation,
        complexity: k.complexity,
        id_scope: k.idScope,
        declared_by: k.productId,
        description: k.description ?? '',
      };
    });
  const stages = [...schema.stages]
    .sort((a, b) => a.position - b.position)
    .map((s): MetaStage => ({ stage: s.name, position: s.position, label: s.label, description: s.description }));
  const relations = Object.values(schema.relations).flatMap((r) =>
    r.pairs.map((p): MetaRelation => ({
      relation: r.name,
      source_kind: p.source,
      target_kind: p.target,
      role: r.role ?? '',
      description: p.description || (r.description ?? ''),
      forward_label: r.forwardLabel,
      reverse_label: r.reverseLabel,
    })),
  );
  const columns = Object.fromEntries(
    Object.values(schema.tables)
      .filter((t) => t.role !== 'link')
      .map((t) => [t.name, t.columns]),
  );
  return { model: { kinds, stages, relations, columns } };
}
