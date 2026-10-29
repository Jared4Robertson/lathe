// The data layer's public interface: the schema, loading the data files, writing them and the merge driver.
export { openStore, Store, LATHE_DATA_DIR } from './store.ts';
export type { StoreOptions, WriteResult } from './store.ts';
export { StoreError, formatProblem } from './problems.ts';
export type { Origin, StoreProblem } from './problems.ts';
export type { Command, KeyInput } from './generic-write.ts';
export { readMigrations, applyMigrations, describeSchema, SCHEMA_DIR, STORED_ROLES } from './schema.ts';
export type {
  ColumnDescription,
  ColumnKind,
  ForeignKey,
  IdScope,
  KindDescription,
  KindParent,
  LinkScope,
  Migration,
  RelationDescription,
  RelationPair,
  SchemaDescription,
  Stage,
  StageDescription,
  TableDescription,
  TableRole,
} from './schema.ts';
export { integrityQueries, type IntegrityQuery } from './integrity.ts';
export { normalizeRow, tableText, rowLine, sortRows, type Row, type Value } from './rows.ts';
export { mergeData, mergeDataFiles, type MergeResult } from './merge.ts';
export type * from './tables.ts';
