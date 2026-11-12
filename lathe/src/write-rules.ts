// The rules a write is held to on the rows it writes, beside what every load holds the whole data to: what may stay in
// data already written, as a check's warning, but is refused when a command writes it (LA-STD-PRINCIPLES-R01). The
// commit runs them on the rows the write adds or changes (platform/data/transaction.ts), with the data as the write
// leaves it.
//
// Essential records keep accidental complexity out (LA-STD-PRINCIPLES-R05, LA-CHK-UC08):
// - essential-names-technology: an essential record the write adds, or whose title or lead it changes, that names a
//   word its kind's group has no business with (essential.ts: Lathe's words, a term of any of its product's domains
//   excused; the titles of its product's interfaces, a variant step's own excused; the product's technology words) in
//   the text the write sets: an add's title and lead, a change's only where it changes them. accidental-in-essential
//   warns of every record in the data, whatever text it names the word in;
// - essential-links-accidental: a link the write adds from an essential record to an accidental one, or a product
//   relation it declares from an essential kind to an accidental kind. Only measured_by may: what measures an
//   outcome may be a report or a script.
//
// A use case is one role invoking one command, or asking one query: its result (LA-STD-MODELING-R15):
// - use-case-invokes-another-command: an invokes link the write adds from a step to a command that is not its use
//   case's result, or a result it sets that leaves a step of the flow invoking another command;
// - use-case-identity-taken: a use case the write adds, or whose result or first actor it changes, that has the same
//   first actor and result as another use case of its product.
// The check rows of the same names report what data already written holds.
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

/** The words a record of the group, in the product, has no business with: a term of any of its domains is the product's language. */
function wordsFor(view: ReadView, group: WordGroup, product: string | null, ownInterface: string | undefined): string[] {
  const productDomains = new Set(view.rows('domain').filter((d) => d.product_id === product).map((d) => String(d.id)));
  const terms = new Set(
    view
      .rows('term')
      .filter((t) => productDomains.has(String(t.domain_id)))
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

/** The essential record's columns given (its title, its lead or both), with the word each names, when it names one. */
function namesTechnology(view: ReadView, placement: Placement, kind: string, row: Row, columns: readonly string[]): string | undefined {
  const description = view.schema.kinds[kind];
  const group = description && wordGroupOf(description);
  if (!group) return undefined;
  const id = String(row.id);
  if (placement.complexityOf(id) !== 'essential') return undefined;
  const own = ownInterfaceOf(view, kind, row)?.toLowerCase();
  const words = wordsFor(view, group, placement.productOf(id), own);
  const said = (column: string) => {
    const text = typeof row[column] === 'string' ? String(row[column]).toLowerCase() : '';
    const word = wordNamed(own ? text.replaceAll(own, ' ') : text, words);
    return word ? `its ${column} says "${word}"` : undefined;
  };
  const found = columns.map(said).filter(Boolean);
  return found.length ? found.join(' and ') : undefined;
}

const essentialNamesTechnology: WriteRule = {
  name: 'essential-names-technology',
  check: (view, changes) => {
    const placement = placementOf(view);
    return changes.flatMap((change) => {
      const { table, before, after } = change;
      if (!after || !view.schema.kinds[table]) return [];
      // Only the text the write sets is read: an add sets its title and lead, a change those whose value it changes,
      // so a record whose title the owner accepts with a warning can still have its lead text changed.
      const lead = view.schema.tables[table].columns.find((c) => isLeadColumn(c.name))?.name;
      const written = ['title', ...(lead ? [lead] : [])].filter((column) => !before || before[column] !== after[column]);
      if (!written.length) return [];
      const said = namesTechnology(view, placement, table, after, written);
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

/** A use case's result, by use case ID, and its flow's steps' use case, by step ID, as the write leaves them. */
function useCaseLinks(view: ReadView) {
  const results = new Map(view.rows('use_case').map((u) => [String(u.id), String(u.result_id)]));
  const useCaseOfFlow = new Map(view.rows('flow').map((f) => [String(f.id), String(f.use_case_id)]));
  const useCaseOfStep = new Map(view.rows('flow_step').map((s) => [String(s.id), useCaseOfFlow.get(String(s.flow_id))]));
  const commands = new Set(view.rows('command').map((c) => String(c.id)));
  return { results, useCaseOfStep, commands };
}

const useCaseInvokesAnotherCommand: WriteRule = {
  name: 'use-case-invokes-another-command',
  check: (view, changes) => {
    const { results, useCaseOfStep, commands } = useCaseLinks(view);
    const refused = (row: Row, table: string, step: string, command: string, useCase: string): RuleProblem => ({
      rule: 'use-case-invokes-another-command',
      table,
      row,
      message: `Flow step ${step} of ${useCase} would invoke the command ${command}, but the use case's result is ${results.get(useCase)}: a use case invokes no command but its result; make ${command} its own use case, joined to this one in a journey, or the command of a policy.`,
    });
    return changes.flatMap((change): RuleProblem[] => {
      const { table, before, after } = change;
      if (!after) return [];
      if (table === 'invokes') {
        const step = String(after.source_id);
        const command = String(after.target_id);
        const useCase = useCaseOfStep.get(step);
        if (!useCase || !commands.has(command) || results.get(useCase) === command) return [];
        return [refused(after, table, step, command, useCase)];
      }
      if (table === 'use_case' && before?.result_id !== after.result_id) {
        const useCase = String(after.id);
        return view
          .rows('invokes')
          .filter((i) => useCaseOfStep.get(String(i.source_id)) === useCase && commands.has(String(i.target_id)) && String(i.target_id) !== String(after.result_id))
          .map((i) => refused(after, table, String(i.source_id), String(i.target_id), useCase));
      }
      return [];
    });
  },
};

const useCaseIdentityTaken: WriteRule = {
  name: 'use-case-identity-taken',
  check: (view, changes) => {
    // The use cases whose identity the write sets: added, or with a new result or first actor.
    const touched = new Map<string, { table: string; row: Row }>();
    for (const { table, before, after } of changes) {
      if (!after) continue;
      if (table === 'use_case' && before?.result_id !== after.result_id) touched.set(String(after.id), { table, row: after });
      if (table === 'use_case_actor' && Number(after.position) === 1 && before?.role_name !== after.role_name && !touched.has(String(after.use_case_id))) {
        touched.set(String(after.use_case_id), { table, row: after });
      }
    }
    if (touched.size === 0) return [];
    const placement = placementOf(view);
    const firstActor = new Map(view.rows('use_case_actor').filter((a) => Number(a.position) === 1).map((a) => [String(a.use_case_id), String(a.role_name)]));
    const identity = (useCase: Row) => {
      const id = String(useCase.id);
      const actor = firstActor.get(id);
      return actor === undefined ? undefined : `${placement.productOf(id) ?? ''} ${actor} ${String(useCase.result_id)}`;
    };
    const useCases = view.rows('use_case');
    return [...touched].flatMap(([id, { table, row }]): RuleProblem[] => {
      const own = useCases.find((u) => String(u.id) === id);
      const key = own && identity(own);
      if (!own || key === undefined) return [];
      const other = useCases.filter((u) => String(u.id) !== id && identity(u) === key).map((u) => String(u.id)).sort()[0];
      if (!other) return [];
      return [{
        rule: 'use-case-identity-taken',
        table,
        row,
        message: `Use case ${id} would have the same first actor (${firstActor.get(id)}) and result (${String(own.result_id)}) as ${other}: no two use cases of a product share both; change ${other} instead.`,
      }];
    });
  },
};

/** Every rule a write is held to on the rows it writes. */
export const WRITE_RULES: readonly WriteRule[] = [essentialNamesTechnology, essentialLinksAccidental, useCaseInvokesAnotherCommand, useCaseIdentityTaken];
