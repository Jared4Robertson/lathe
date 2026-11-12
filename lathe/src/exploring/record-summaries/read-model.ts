// The Record summaries read model (LA-EXP-RM01), shaped for the Record page pattern: every record of a product's space
// (its own and those of no product) as a link to it reads it (its kind, title, parent, and the product and domain it
// sits in), the group heading it is listed under, a test's state, its data file and line, a digest of its rows (so a
// reload tells which records changed), and the links among them both ways. It holds no column of a record beyond
// these: a page reads its record's fields through its aggregate's own query. The projection is the only code that reads
// the source rows for the query and the only code that writes the read model's table.
import { COLUMN_LINKS } from './column-links.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { inSpace, placementOf } from '../placement.ts';
import { idOrder } from '../../platform/data/ids.ts';

/** One record as a link to it, a list row and the page's frame read it. */
export interface RecordSummary {
  id: string;
  kind: string;
  title: string;
  parent: string | null;
  product: string | null;
  domain: string | null;
  /** The heading it is listed under among its kind (`group_name`), or null. */
  group: string | null;
  /** A test's state (automated, manual, not automated yet), or null for a record that is no test. */
  testState: string | null;
  /** What it names in code: its file, or else its name (a table's); null for a record that names neither. */
  names: string | null;
  /** A test's level (unit, integration, end to end…), or null for a record that is no test. */
  level: string | null;
  /** Its kind's data file in its product's data folder, such as use_case.jsonl, and its line there, from 1. */
  file: string;
  line: number;
  /** A digest of its rows (its own row, the part rows it owns and the links it starts): it changes when they do. */
  digest: string;
}

/** One link between two records of the space. */
export interface SummaryLink {
  source: string;
  relation: string;
  target: string;
}

/** The columns of a record's summary, in the order an answer gives each record's values. */
const SUMMARY_COLUMNS = ['id', 'kind', 'title', 'parent', 'product', 'domain', 'group', 'testState', 'names', 'level', 'file', 'line', 'digest'] as const satisfies readonly (keyof RecordSummary)[];

/** One record's summary as an answer gives it: its values, in the order of the answer's columns. */
type SummaryRow = RecordSummary[keyof RecordSummary][];

/**
 * A product's space as its pages name its records. Each record is its values in the order of `columns`, which the
 * answer names once rather than once per record: a large product's space holds tens of thousands of records, and the
 * names would be four in ten of the answer's bytes (LA-PLT-UC03-R05).
 */
export interface RecordSummaries {
  product: string;
  /** The columns of each record's values. */
  columns: readonly (keyof RecordSummary)[];
  /** Its records in ID order, each as its values. */
  records: SummaryRow[];
  /** The links among them, by source, relation and target. */
  links: SummaryLink[];
}

/** An answer's records, each as its summary, in ID order. */
export function summariesIn(answer: RecordSummaries): RecordSummary[] {
  return answer.records.map((values) => Object.fromEntries(answer.columns.map((column, at) => [column, values[at]])) as unknown as RecordSummary);
}

/** The read model's table, kept in memory: each product's summaries, by product. */
export interface RecordSummariesTable {
  products: Map<string, RecordSummaries>;
}

const textColumn = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

/** A short, stable digest of a text (FNV-1a, 32 bits, in hex). */
function digestOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The digest of each record's rows as last worked out, by its own row: a row is never changed once read, so while the
 * record's row and the rows it owns are the same objects, its digest is the same (a reload builds again only the
 * records whose rows it read again).
 */
const digests = new WeakMap<Row, { owned: readonly (readonly [string, Row])[]; digest: string }>();

// A record's digest: of its row and the rows it owns, kept while they are the same objects.
function recordDigest(row: Row, owned: readonly (readonly [string, Row])[]): string {
  const known = digests.get(row);
  if (known && known.owned.length === owned.length && known.owned.every(([table, r], at) => owned[at][0] === table && owned[at][1] === r)) return known.digest;
  const digest = digestOf(JSON.stringify([row, owned]));
  digests.set(row, { owned, digest });
  return digest;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function recordSummariesTableFrom(view: ReadView): RecordSummariesTable {
  const { schema } = view;
  const placed = placementOf(view);
  // Each record's part rows and the links it starts, read once per table, for its digest; and every link.
  const owned = new Map<string, (readonly [string, Row])[]>();
  const own = (id: string, value: readonly [string, Row]) => {
    const list = owned.get(id);
    if (list) list.push(value);
    else owned.set(id, [value]);
  };
  const links: SummaryLink[] = [];
  for (const table of Object.values(schema.tables)) {
    if (table.role === 'part' && table.ownerColumn) {
      for (const row of view.rows(table.name)) own(String(row[table.ownerColumn]), [table.name, row]);
    } else if (table.role === 'link') {
      for (const row of view.rows(table.name)) {
        const link = { source: String(row.source_id), relation: table.name, target: String(row.target_id) };
        links.push(link);
        own(link.source, [table.name, row]);
      }
    }
  }
  // A column reference's link is its record's own row, already in its digest.
  for (const c of COLUMN_LINKS) {
    for (const row of view.rows(c.table)) if (row[c.column] != null) links.push({ source: String(row.id), relation: c.relation, target: String(row[c.column]) });
  }
  const stageOf = (kind: string) => schema.kinds[kind]?.stage ?? null;
  // A test: a test-plan kind with a run by, whose state says how it runs.
  const testKinds = new Set(Object.keys(schema.kinds).filter((kind) => stageOf(kind) === 'test-plan' && schema.tables[kind]?.columns.some((c) => c.name === 'state' && c.required)));
  const testState = (kind: string, row: Row): string | null => (testKinds.has(kind) ? textColumn(row.state) : null);
  const summaries: RecordSummary[] = [...placed.values()].map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    parent: r.parent,
    product: r.product,
    domain: r.domain,
    group: typeof r.row.group_name === 'string' && r.row.group_name.trim() !== '' ? r.row.group_name : null,
    testState: testState(r.kind, r.row),
    names: textColumn(r.row.file) ?? (stageOf(r.kind) === 'technical-specification' ? textColumn(r.row.name) : null),
    level: testState(r.kind, r.row) === null ? null : textColumn(r.row.level),
    file: `${r.kind}.jsonl`,
    line: r.line,
    digest: recordDigest(r.row, owned.get(r.id) ?? []),
  }));
  const order = idOrder(summaries.map((r) => r.id));
  summaries.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const products = new Map<string, RecordSummaries>();
  for (const p of summaries.filter((r) => r.kind === 'product')) {
    const records = summaries.filter((r) => inSpace(placed.get(r.id)!, p.id));
    const ids = new Set(records.map((r) => r.id));
    // A link to an ID that is no record stays with the record that names it.
    const within = links.filter((l) => ids.has(l.source) && (ids.has(l.target) || !placed.has(l.target)));
    products.set(p.id, { product: p.id, columns: SUMMARY_COLUMNS, records: records.map((r) => SUMMARY_COLUMNS.map((column) => r[column])), links: within });
  }
  return { products };
}
