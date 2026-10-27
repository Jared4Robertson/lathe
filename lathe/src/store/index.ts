// The store's public interface: the schema, loading the data files, the command layer and the merge driver.
export { openStore, Store, StoreError, formatProblem, LATHE_DATA_DIR } from './store.ts';
export type { Command, KeyInput, Origin, StoreOptions, StoreProblem, WriteResult } from './store.ts';
export { readMigrations, applyMigrations, describeSchema, SCHEMA_DIR, STORED_ROLES } from './schema.ts';
export type {
  ColumnDescription,
  ColumnKind,
  ForeignKey,
  KindDescription,
  KindParent,
  Migration,
  RelationDescription,
  RelationPair,
  SchemaDescription,
  SectionDescription,
  TableDescription,
  TableRole,
} from './schema.ts';
export { validationQueries, type ValidationQuery } from './validation.ts';
export { normalizeRow, tableText, rowLine, sortRows, type Row, type Value } from './rows.ts';
export { mergeData, mergeDataFiles, type MergeResult } from './merge.ts';
export type * from './tables.ts';
