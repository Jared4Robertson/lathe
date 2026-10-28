// What the authoring tests share: Lathe's schema as the store describes it, and Lathe's reference.
import { buildReference, openStore, PACKAGE_DIR, type Reference, type SchemaDescription } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { writeData } from '../helpers.ts';

/** Lathe's schema, read from a store holding a record of every kind. */
export async function latheSchema(): Promise<SchemaDescription> {
  const store = await openStore(writeData(everyKind()), { latheDataDir: null });
  try {
    return store.schema;
  } finally {
    await store.close();
  }
}

/** Lathe's own reference, built from its schema, check rows and coverage rules. */
export const latheReference = (): Promise<Reference> => buildReference(PACKAGE_DIR);

/** A kind's parents as `kind.column`, a relation's pairs as `source>target`: short forms to compare. */
export const parentsOf = (schema: SchemaDescription, kind: string) => schema.kinds[kind].parents.map((p) => `${p.kind}.${p.column}`);
export const pairsOf = (schema: SchemaDescription, relation: string) => schema.relations[relation].pairs.map((p) => `${p.source}>${p.target}`).sort();

/** The required columns of a table, besides its id and title. */
export const requiredOf = (schema: SchemaDescription, table: string) =>
  schema.tables[table].columns.filter((c) => c.required && c.name !== 'id' && c.name !== 'title').map((c) => c.name);

/** Expects each kind and table to be described in the reference, and returns the reference's entries for the kinds. */
export function described(ref: Reference, kinds: string[], tables: string[] = []) {
  for (const name of [...kinds, ...tables]) {
    const table = ref.tables.find((t) => t.name === name);
    if (!table?.description.trim()) throw new Error(`The reference does not describe ${name}.`);
  }
  return kinds.map((name) => {
    const kind = ref.kinds.find((k) => k.kind === name);
    if (!kind?.description.trim()) throw new Error(`The reference does not describe the kind ${name}.`);
    return kind;
  });
}
