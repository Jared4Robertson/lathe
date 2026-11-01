// The Meta model read (LA-PLT-RM08): Lathe's kinds, stages and relations with each product's own, and each table's
// columns, as the app names and draws every record and field; answered from the read model through its reader
// (reader.ts). Its handler never sees the data and changes nothing. This slice holds only the read, so it names its
// read model where an aggregate's slice names its aggregate.
import type { QueryDefinition } from '../commands/definition.ts';
import type { MetaModel } from './read-model.ts';
import { metaModelReader, type MetaModelReader } from './reader.ts';
import { GET_META_MODEL_IDENTITY } from './queries.generated.ts';

/** The meta model of every product the workspace shows. */
export const getMetaModel = (reader: MetaModelReader): MetaModel => reader.model();

/** Get the meta model (LA-PLT-QRY11). */
export const GET_META_MODEL: QueryDefinition<Record<string, never>, MetaModel, MetaModelReader> = {
  ...GET_META_MODEL_IDENTITY,
  input: {},
  reader: metaModelReader,
  run: getMetaModel,
  text: (m) =>
    [
      `${m.kinds.length} kinds · ${m.stages.length} stages · ${new Set(m.relations.map((r) => r.relation)).size} relations`,
      ...m.stages.map((s) => `  ${s.label}: ${m.kinds.filter((k) => k.stage === s.stage).map((k) => k.label).join(', ')}`),
    ].join('\n'),
};
