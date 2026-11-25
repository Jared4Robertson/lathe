// The Guarantee aggregate's read model (LA-MOD-RM44), shaped for its readers: the Guarantee page reads a guarantee whole
// (its statement, the building blocks that keep it, its guarantee tests with the test data sets they start from) with
// the record the page is about, a domain's list reads each guarantee's ID and title, and the editor's next ID reads the
// IDs in use. The projection (guaranteeTableFrom) is the only code that reads the source rows and the only code that
// writes the read model's table; the query handlers read that table only through the reader (reader.ts). Nothing here
// is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { GuaranteeRow, GuaranteeTestRow } from '../../platform/data/tables.ts';
import type { GuaranteeKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A guarantee test as the page shows it: its row and the test data sets it starts from. */
export interface GuaranteeTestOnPage {
  test: GuaranteeTestRow;
  startsFrom: string[];
}

/** A guarantee whole, as its page shows it. */
export interface GuaranteeTree {
  guarantee: GuaranteeRow;
  /** The building blocks that keep it, by ID. */
  keptBy: string[];
  /** Its guarantee tests, by ID. */
  tests: GuaranteeTestOnPage[];
}

/** A guarantee as its page reads it, with the record of it the page is about. */
export interface GuaranteePage extends GuaranteeTree {
  record: { id: string; kind: GuaranteeKind };
}

/** A guarantee as a domain's list reads it. */
export interface GuaranteeSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface GuaranteeTable {
  /** Each guarantee whole, by its ID. */
  guarantees: Map<string, GuaranteeTree>;
  /** Each record inside a guarantee: the guarantee that holds it and its kind there. */
  holding: Map<string, { root: string; kind: GuaranteeKind }>;
  /** Each domain's guarantees, by ID; a domain with none has an empty list. */
  domains: Map<string, GuaranteeSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** A link table's other ends by one column, each list sorted. */
function linked(rows: Row[], by: string, other: string): (id: string) => string[] {
  const found = new Map<string, string[]>();
  for (const r of rows) found.set(String(r[by]), [...(found.get(String(r[by])) ?? []), String(r[other])]);
  return (id) => [...(found.get(id) ?? [])].sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function guaranteeTableFrom(view: ReadView): GuaranteeTable {
  const keptBy = linked(view.rows('kept_by'), 'source_id', 'target_id');
  const startsFrom = linked(view.rows('starts_from'), 'source_id', 'target_id');
  const testsOf = new Map<string, GuaranteeTestRow[]>();
  for (const t of view.rows('guarantee_test') as unknown as GuaranteeTestRow[]) testsOf.set(t.guarantee_id, [...(testsOf.get(t.guarantee_id) ?? []), t]);
  const guarantees = new Map<string, GuaranteeTree>();
  const holding = new Map<string, { root: string; kind: GuaranteeKind }>();
  const domains = new Map<string, GuaranteeSummary[]>(view.rows('domain').map((d) => [String(d.id), []]));
  for (const guarantee of view.rows('guarantee') as unknown as GuaranteeRow[]) {
    const root = guarantee.id;
    const tests = [...(testsOf.get(root) ?? [])].sort(byRecordId);
    guarantees.set(root, { guarantee, keptBy: keptBy(root), tests: tests.map((test) => ({ test, startsFrom: startsFrom(test.id) })) });
    holding.set(root, { root, kind: 'guarantee' });
    for (const t of tests) holding.set(t.id, { root, kind: 'guarantee_test' });
    domains.get(guarantee.domain_id)?.push({ id: root, title: guarantee.title });
  }
  for (const list of domains.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { guarantees, holding, domains, kinds };
}
