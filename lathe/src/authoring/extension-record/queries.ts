// The Extension record aggregate's own reads (read model LA-AUT-RM39): a record of a product's own kind as its page
// shows it, the records of a kind under one parent, and the next free ID for a record of a kind. Each reads only the
// read model and its kind's declaration, through its reader (reader.ts), and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { KindDescription } from '../../platform/data/schema.ts';
import { EXTENSION_RECORD_SLICE } from './model.ts';
import type { ExtensionRecordPage, ExtensionRecordSummary } from './read-model.ts';
import { extensionRecordReader, type ExtensionRecordReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

// The product kind by name, or a refusal naming the product kinds there are.
function productKind(reader: ExtensionRecordReader, name: string): KindDescription {
  const kinds = reader.productKinds();
  return kinds.find((k) => k.name === name) ?? refuse('kind', `${name} is not a product kind; the products declare ${kinds.map((k) => k.name).join(', ') || 'none'}`);
}

/** The page of the record of a product's own kind with this ID. */
export function getExtensionRecord(view: ReadView, input: { id: string }): ExtensionRecordPage {
  const reader = extensionRecordReader(view);
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!reader.productKinds().some((k) => k.name === kind)) refuse('kind', `${input.id} is a ${kind}, one of Lathe's kinds, not a record of a product's own kind`);
  return reader.page(input.id);
}

/** GET an extension record whole (LA-AUT-QRY118). */
export const GET_EXTENSION_RECORD: QueryDefinition<{ id: string }, ExtensionRecordPage> = {
  id: 'LA-AUT-QRY118',
  slice: EXTENSION_RECORD_SLICE,
  name: 'get-extension-record',
  description: "Reads a record of a product's own kind whole: its kind, its row, the links it starts by relation, and the packages it uses.",
  method: 'GET',
  route: '/api/extension-record/get-extension-record',
  input: { id: id('The record.', 'required') },
  run: getExtensionRecord,
  text: extensionRecordText,
};

/** The records of a product kind under one parent, by ID. */
export function listExtensionRecords(view: ReadView, input: { kind: string; parent: string }): ExtensionRecordSummary[] {
  const reader = extensionRecordReader(view);
  return reader.list(productKind(reader, input.kind).name, input.parent);
}

/** List the records of a product kind under one parent (LA-AUT-QRY119). */
export const LIST_EXTENSION_RECORDS: QueryDefinition<{ kind: string; parent: string }, ExtensionRecordSummary[]> = {
  id: 'LA-AUT-QRY119',
  slice: EXTENSION_RECORD_SLICE,
  name: 'list-extension-records',
  description: 'Lists the records of a product kind under one parent, by ID, with their titles.',
  method: 'GET',
  route: '/api/extension-record/list-extension-records',
  input: {
    kind: id('The product kind, by name.', 'required'),
    parent: id('The record they sit under.', 'required'),
  },
  run: listExtensionRecords,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No records.'),
};

// The end of a kind's ID after its base: letters and a number (RP<nn>), letters alone (CLI), or null for none.
function idEnd(pattern: string): { letters: string; width: number } | null {
  const m = /-([A-Z]+)(?:<(n+)>)?$/.exec(pattern.trim());
  return m ? { letters: m[1], width: m[2]?.length ?? 0 } : null;
}

/**
 * The next free ID for a record of a product kind under its parent, by the kind's declared ID pattern: one past the
 * highest in use. A pattern that starts <P>-<D>- numbers it in its parent's domain, <P>- in its product, and any other
 * start (<domain>-, <command>-) under the parent itself; a pattern ending in letters alone (<command>-CLI) gives the one
 * ID while it is free.
 */
export function nextExtensionRecordId(view: ReadView, input: { kind: string; parent: string }): string {
  const reader = extensionRecordReader(view);
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
  const shape = new RegExp(`^${start!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${end.letters}(\\d+)$`);
  let highest = 0;
  for (const id of reader.ids()) {
    const m = shape.exec(id);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${start}-${end.letters}${String(highest + 1).padStart(end.width, '0')}`;
}

/** Get the next ID for a record of a product kind (LA-AUT-QRY126). */
export const NEXT_EXTENSION_RECORD_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY126',
  slice: EXTENSION_RECORD_SLICE,
  name: 'next-id',
  description: "The next free ID for a record of a product kind under its parent, by the kind's declared ID pattern: one past the highest in use.",
  method: 'GET',
  route: '/api/extension-record/next-id',
  input: {
    kind: id('The product kind, by name.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
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

/** The Extension record aggregate's queries, as the CLI and the MCP server register them. */
export const EXTENSION_RECORD_QUERIES: readonly AnyQuery[] = [GET_EXTENSION_RECORD, LIST_EXTENSION_RECORDS, NEXT_EXTENSION_RECORD_ID];
