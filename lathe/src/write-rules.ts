// The rules a write is held to on the rows it writes, beside what every load holds the whole data to: what may stay in
// data already written, as a check's warning, but is refused when a command writes it (LA-STD-PRINCIPLES-R01). The
// commit runs them on the rows the write adds or changes (platform/data/transaction.ts), with the data as the write
// leaves it.
//
// Essential records keep accidental complexity out (LA-STD-PRINCIPLES-R05, LA-CHK-UC08):
// - essential-names-technology: an essential record the write adds, or whose title or lead it changes, that names a
//   word its kind's group has no business with (essential.ts: Lathe's words, a term of its own domain excused; the
//   titles of its product's interfaces, a variant step's own excused; the product's technology words), as
//   accidental-in-essential warns of a record already in the data;
// - essential-links-accidental: a link the write adds from an essential record to an accidental one, or a product
//   relation it declares from an essential kind to an accidental kind. Only measured_by may: what measures an
//   outcome may be a report or a script.
import type { RowChange } from './server/contract.ts';
import { ESSENTIAL_WORDS, placementOf, wordGroupOf, wordNamed, type Placement, type WordGroup } from './essential.ts';
import { isLeadColumn } from './lead.ts';
import type { ReadView, RuleProblem } from './platform/data/rules.ts';
import type { Row } from './platform/data/rows.ts';

/** A rule over the rows one write adds or changes. */
export interface WriteRule {
  name: string;
  /** Every problem of the changed rows, read against the data as the write leaves it. */
  check(view: ReadView, changes: readonly RowChange[]): RuleProblem[];
}

/** The one relation whose links may run from an essential record to an accidental one. */
const MEASURED_BY = 'measured_by';

/** The title of the interface a variant step names, which is the step's to name; undefined for any other record. */
function ownInterfaceOf(view: ReadView, kind: string, row: Row): string | undefined {
  const at = kind === 'flow_step' && row.interface_id ? view.record(String(row.interface_id)) : undefined;
  return at ? String(at.row.title) : undefined;
}

/** The words a record of the group, in the product and domain, has no business with. */
function wordsFor(view: ReadView, group: WordGroup, product: string | null, domain: string | undefined, ownInterface: string | undefined): string[] {
  const productDomains = new Set(view.rows('domain').filter((d) => d.product_id === product).map((d) => String(d.id)));
  const terms = new Set(
    view
      .rows('term')
      .filter((t) => (domain === undefined ? productDomains.has(String(t.domain_id)) : t.domain_id === domain))
      .map((t) => String(t.title).trim().toLowerCase()),
  );
  const own = ownInterface?.trim().toLowerCase();
  const interfaces = group === 'model' ? view.rows('interface').filter((i) => i.product_id === product).map((i) => String(i.title).trim().toLowerCase()) : [];
  const setting = view.rows('product_setting').find((s) => s.product_id === product);
  return [
    ...ESSENTIAL_WORDS.filter((w) => w.group === group && !terms.has(w.word)).map((w) => w.word),
    ...interfaces.filter((i) => i !== own),
    ...((setting?.technology_words as string[] | undefined) ?? []),
  ];
}

/** The essential record's title and lead, with the word each names, when it names one. */
function namesTechnology(view: ReadView, placement: Placement, kind: string, row: Row): string | undefined {
  const description = view.schema.kinds[kind];
  const group = description && wordGroupOf(description);
  if (!group) return undefined;
  const id = String(row.id);
  if (placement.complexityOf(id) !== 'essential') return undefined;
  const own = ownInterfaceOf(view, kind, row)?.toLowerCase();
  const words = wordsFor(view, group, placement.productOf(id), placement.domainOf(id), own);
  const lead = view.schema.tables[kind].columns.find((c) => isLeadColumn(c.name))?.name;
  const said = (column: string) => {
    const text = typeof row[column] === 'string' ? String(row[column]).toLowerCase() : '';
    const word = wordNamed(own ? text.replaceAll(own, ' ') : text, words);
    return word ? `its ${column} says "${word}"` : undefined;
  };
  const found = [said('title'), lead ? said(lead) : undefined].filter(Boolean);
  return found.length ? found.join(' and ') : undefined;
}

const essentialNamesTechnology: WriteRule = {
  name: 'essential-names-technology',
  check: (view, changes) => {
    const placement = placementOf(view);
    return changes.flatMap((change) => {
      const { table, before, after } = change;
      if (!after || !view.schema.kinds[table]) return [];
      const lead = view.schema.tables[table].columns.find((c) => isLeadColumn(c.name))?.name;
      if (before && before.title === after.title && (!lead || before[lead] === after[lead])) return [];
      const said = namesTechnology(view, placement, table, after);
      if (!said) return [];
      return [{
        rule: 'essential-names-technology',
        table,
        row: after,
        message: `${view.schema.kinds[table].label} ${String(after.id)} is essential, and ${said}: say what the product's people need in their own words and leave the mechanism to the pattern or technical record that decides it, or split the record.`,
      }];
    });
  },
};

const essentialLinksAccidental: WriteRule = {
  name: 'essential-links-accidental',
  check: (view, changes) => {
    const placement = placementOf(view);
    const ownKinds = new Map(view.rows('product_kind').map((k) => [String(k.name), k]));
    const kindComplexity = (name: string) => {
      const own = ownKinds.get(name);
      if (own) return own.stage === 'technical-specification' ? 'accidental' : own.complexity;
      return view.schema.kinds[name]?.complexity ?? null;
    };
    const label = (id: string) => {
      const at = view.record(id);
      return at ? `${view.schema.kinds[at.kind]?.label ?? at.kind} ${id}` : id;
    };
    return changes.flatMap((change): RuleProblem[] => {
      const { table, before, after } = change;
      if (!after || before || table === MEASURED_BY) return [];
      if (table === 'product_relation') {
        if (after.name === MEASURED_BY || kindComplexity(String(after.source_kind)) !== 'essential' || kindComplexity(String(after.target_kind)) !== 'accidental') return [];
        return [{
          rule: 'essential-links-accidental',
          table,
          row: after,
          message: `The relation ${String(after.name)} would link the essential ${String(after.source_kind)} to the accidental ${String(after.target_kind)}: an essential record never points at how it is built; link the other way, from the technical record to what it implements, builds or fills.`,
        }];
      }
      if (!view.schema.relations[table]) return [];
      const source = String(after.source_id);
      const target = String(after.target_id);
      if (placement.complexityOf(source) !== 'essential' || placement.complexityOf(target) !== 'accidental') return [];
      return [{
        rule: 'essential-links-accidental',
        table,
        row: after,
        message: `${label(source)} is essential and ${label(target)} accidental, so ${table} cannot link them: an essential record never points at how it is built; link the other way, from the technical record to what it implements, builds or fills.`,
      }];
    });
  },
};

/** Every rule a write is held to on the rows it writes. */
export const WRITE_RULES: readonly WriteRule[] = [essentialNamesTechnology, essentialLinksAccidental];
