// The Meta model read (LA-PLT-RM08): Lathe's kinds, stages and relations with each product's own, and each table's
// columns, as the app names and draws every record and field; answered from the read model through its reader
// (reader.ts). Its handler never sees the data and changes nothing. This slice holds only the read, so it names its
// read model where an aggregate's slice names its aggregate.
import type { AnyQuery, QueryDefinition, Slice } from '../commands/definition.ts';
import type { MetaModel } from './read-model.ts';
import { metaModelReader, type MetaModelReader } from './reader.ts';

/** How the interfaces reach the Meta model read: `lathe meta-model`, the meta_model_ tools, /api/meta-model/. */
const META_MODEL_SLICE: Slice = { aggregate: 'LA-PLT-RM08', name: 'meta-model' };

/** The meta model of every product the workspace shows. */
export const getMetaModel = (reader: MetaModelReader): MetaModel => reader.model();

/** Get the meta model (LA-PLT-QRY11). */
export const GET_META_MODEL: QueryDefinition<Record<string, never>, MetaModel, MetaModelReader> = {
  id: 'LA-PLT-QRY11',
  slice: META_MODEL_SLICE,
  name: 'get-meta-model',
  method: 'GET',
  route: '/api/meta-model/get-meta-model',
  description: "Gets the meta model: every kind (Lathe's in reading order, then each product's own) with its label, stage, parents and ID scope, the six stages, each pair of kinds a relation may link with its words both ways, and each table's columns.",
  input: {},
  reader: metaModelReader,
  run: getMetaModel,
  text: (m) =>
    [
      `${m.kinds.length} kinds · ${m.stages.length} stages · ${new Set(m.relations.map((r) => r.relation)).size} relations`,
      ...m.stages.map((s) => `  ${s.label}: ${m.kinds.filter((k) => k.stage === s.stage).map((k) => k.label).join(', ')}`),
    ].join('\n'),
};

/** The Meta model read's queries, as the CLI and the MCP server register them. */
export const META_MODEL_QUERIES: readonly AnyQuery[] = [GET_META_MODEL];
