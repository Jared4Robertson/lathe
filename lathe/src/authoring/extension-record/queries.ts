// The Extension record aggregate's own reads (read model LA-AUT-RM39): a record of a product's own kind as its page
// shows it, the records of a kind under one parent, and the next free ID for a record of a kind. Each reads only the
// read model and its kind's declaration, through its reader (reader.ts), and changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { idEnd, onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { KindDescription } from '../../platform/data/schema.ts';
import type { ExtensionRecordPage, ExtensionRecordSummary } from './read-model.ts';
import { extensionRecordReader, type ExtensionRecordReader } from './reader.ts';
import { GET_EXTENSION_RECORD_IDENTITY, LIST_EXTENSION_RECORDS_IDENTITY, NEXT_EXTENSION_RECORD_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

// The product kind by name, or a refusal naming the product kinds there are.
function productKind(reader: ExtensionRecordReader, name: string): KindDescription {
  const kinds = reader.productKinds();
  return kinds.find((k) => k.name === name) ?? refuse('kind', `${name} is not a product kind; the products declare ${kinds.map((k) => k.name).join(', ') || 'none'}`);
}

/** The page of the record of a product's own kind with this ID. */
export function getExtensionRecord(reader: ExtensionRecordReader, input: { id: string }): ExtensionRecordPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!reader.productKinds().some((k) => k.name === kind)) refuse('kind', `${input.id} is a ${kind}, one of Lathe's kinds, not a record of a product's own kind`);
  return reader.page(input.id)!;
}

/** GET an extension record whole (LA-AUT-QRY118). */
export const GET_EXTENSION_RECORD: QueryDefinition<{ id: string }, ExtensionRecordPage, ExtensionRecordReader> = {
  ...GET_EXTENSION_RECORD_IDENTITY,
  input: { id: id('The record.', 'required') },
  reader: extensionRecordReader,
  run: getExtensionRecord,
  text: extensionRecordText,
};

/** The records of a product kind under one parent, by ID. */
export function listExtensionRecords(reader: ExtensionRecordReader, input: { kind: string; parent: string }): ExtensionRecordSummary[] {
  return reader.list(productKind(reader, input.kind).name, input.parent);
}

/** List the records of a product kind under one parent (LA-AUT-QRY119). */
export const LIST_EXTENSION_RECORDS: QueryDefinition<{ kind: string; parent: string }, ExtensionRecordSummary[], ExtensionRecordReader> = {
  ...LIST_EXTENSION_RECORDS_IDENTITY,
  input: {
    kind: id('The product kind, by name.', 'required'),
    parent: id('The record they sit under.', 'required'),
  },
  reader: extensionRecordReader,
  run: listExtensionRecords,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No records.'),
};

/**
 * The next free ID for a record of a product kind under its parent, by the kind's declared ID pattern: one past the
 * highest in use. A pattern that starts <P>-<D>- numbers it in its parent's domain, <P>- in its product, and any other
 * start (<domain>-, <command>-) under the parent itself; a pattern ending in letters alone (<command>-CLI) gives the one
 * ID while it is free.
 */
export function nextExtensionRecordId(reader: ExtensionRecordReader, input: { kind: string; parent: string }): string {
  const kind = productKind(reader, input.kind);
  const parentKind = kind.parents[0].kind;
  const parent = reader.kindOf(input.parent);
  if (parent !== parentKind) refuse('parent', `a ${kind.name} sits under a ${parentKind}, and ${input.parent} is ${parent ? `a ${parent}` : 'no record'}`);
  const pattern = kind.idPattern ?? refuse('id-pattern', `the product kind ${kind.name} declares no ID pattern`);
  const end = idEnd(pattern) ?? refuse('id-pattern', `a ${kind.name}'s ID ends in a name you choose (${pattern}), so it has no next number`);
  const start = pattern.startsWith('<P>-<D>-') ? reader.domainOf(input.parent) : pattern.startsWith('<P>-') ? reader.productOf(input.parent) : input.parent;
  if (!start) refuse('id-pattern', `${input.parent} sits in no ${pattern.startsWith('<P>-<D>-') ? 'domain' : 'product'}, which a ${kind.name}'s ID starts with (${pattern})`);
  if (!end.width) {
    const next = `${start}-${end.letters}`;
    if (reader.kindOf(next)) refuse('exists', `${input.parent} already has its ${kind.name}, ${next}`);
    return next;
  }
  return onePast(reader, `${start}-${end.letters}`, end);
}

/** Get the next ID for a record of a product kind (LA-AUT-QRY126). */
export const NEXT_EXTENSION_RECORD_ID: QueryDefinition<{ kind: string; parent: string }, string, ExtensionRecordReader> = {
  ...NEXT_EXTENSION_RECORD_ID_IDENTITY,
  input: {
    kind: id('The product kind, by name.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: extensionRecordReader,
  run: nextExtensionRecordId,
  text: (next) => next,
};

/** A record as text: its kind and row, then its links and packages. */
function extensionRecordText(record: ExtensionRecordPage): string {
  const lines = [`${record.kind} ${record.id}: ${String(record.values.title)}`, `  under: ${record.parent}`];
  for (const [column, value] of Object.entries(record.values)) if (column !== 'title') lines.push(`  ${column}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  for (const [relation, targets] of Object.entries(record.links)) lines.push(`  ${relation}: ${targets.join(', ')}`);
  if (record.packages.length) lines.push(`  packages: ${record.packages.join(', ')}`);
  return lines.join('\n');
}
