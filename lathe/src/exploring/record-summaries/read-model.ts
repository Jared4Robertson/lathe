// The Record summaries read model (LA-EXP-RM01), shaped for the Record page pattern: every record of a product's space
// (its own and those of no product) as a link to it reads it (its kind, title, parent, and the product and domain it
// sits in), the group heading it is listed under, a test's state, its data file and line, a digest of its rows (so a
// reload tells which records changed), and the links among them both ways. It holds no column of a record beyond
// these: a page reads its record's fields through its aggregate's own query. The projection is the only code that reads
// the source rows for the query and the only code that writes the read model's table.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { inSpace, placeRecords } from '../placement.ts';

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

/** A product's space as its pages name its records. */
export interface RecordSummaries {
  product: string;
  /** Its records in ID order. */
  records: RecordSummary[];
  /** The links among them, by source, relation and target. */
  links: SummaryLink[];
}

/** The read model's table, kept in memory: each product's summaries, by product. */
export interface RecordSummariesTable {
  products: Map<string, RecordSummaries>;
}

const textColumn = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** A short, stable digest of a text (FNV-1a, 32 bits, in hex). */
function digestOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function recordSummariesTableFrom(view: ReadView): RecordSummariesTable {
  const { schema } = view;
  const placed = placeRecords(view);
  // Each record's part rows and the links it starts, read once per table, for its digest; and every link.
  const owned = new Map<string, unknown[]>();
  const own = (id: string, value: unknown) => owned.set(id, [...(owned.get(id) ?? []), value]);
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
  const stageOf = (kind: string) => schema.kinds[kind]?.stage ?? null;
  // A test: a test-plan kind with a run by, whose state says how it runs.
  const testState = (kind: string, row: Row): string | null =>
    stageOf(kind) === 'test-plan' && schema.tables[kind]?.columns.some((c) => c.name === 'state' && c.required) ? textColumn(row.state) : null;
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
    digest: digestOf(JSON.stringify([r.row, owned.get(r.id) ?? []])),
  }));
  summaries.sort((a, b) => byId(a.id, b.id));
  const products = new Map<string, RecordSummaries>();
  for (const p of summaries.filter((r) => r.kind === 'product')) {
    const records = summaries.filter((r) => inSpace(placed.get(r.id)!, p.id));
    const ids = new Set(records.map((r) => r.id));
    // A link to an ID that is no record stays with the record that names it.
    const within = links.filter((l) => ids.has(l.source) && (ids.has(l.target) || !placed.has(l.target)));
    products.set(p.id, { product: p.id, records, links: within });
  }
  return { products };
}
