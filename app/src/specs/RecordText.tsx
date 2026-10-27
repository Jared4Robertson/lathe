import type { ReactNode } from 'react';
import { parentColumns, partsOf, textOf, type Row, type SpecIndex, type SpecRecord } from './data';
import { Prose } from './mentions';
import { Section } from './parts';
import { appliesWhenOf, appliesWhenText, settingOfRow, settingText } from './patterns';

// A record's typed fields, in place of a Markdown body: its text fields (a requirement's statement,
// a use case's goal, a test's Given, When and Then, the notes) on the page, read as Markdown, and its
// short fields (a route, a method, a file, a state) as facts beside it. Its part rows show too: an
// entity's or event's fields as a table, a use case's steps in order, a product's roles.

/** Text columns that open the page, without a heading, in this order. */
const LEAD_COLUMNS = ['statement', 'goal', 'description'] as const;
/** Text columns shown under their own heading, after the lead. */
const TITLED_COLUMNS: readonly { column: string; title: string }[] = [
  { column: 'identity', title: 'Identity' },
  { column: 'statements', title: 'Statements' },
];
/** A test's three parts, shown together. */
const SCENARIO_COLUMNS = ['given', 'when', 'then'] as const;
/** Every column the page shows as text; the rest of a record's columns are facts. */
export const TEXT_COLUMNS: ReadonlySet<string> = new Set([...LEAD_COLUMNS, ...TITLED_COLUMNS.map((c) => c.column), ...SCENARIO_COLUMNS, 'notes']);
/** A pattern rule's applies-when columns read as one fact. */
const APPLIES_WHEN_COLUMNS: ReadonlySet<string> = new Set(['applies_when_setting', 'applies_when_negated', 'applies_when_value']);

const label = (column: string) => column.replaceAll('_', ' ');

/** The part tables a record's page lays out itself, in place of listing their rows as facts. */
const SHOWN_PARTS: ReadonlySet<string> = new Set(['entity_field', 'event_field', 'use_case_step', 'pattern_setting', 'api_shape', 'role']);

/** The record's text fields and part rows, for the body of its page. */
export function RecordText({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const { row, id } = record;
  const lead = LEAD_COLUMNS.filter((c) => textOf(row, c).trim());
  const titled = TITLED_COLUMNS.filter((c) => textOf(row, c.column).trim());
  const scenario = SCENARIO_COLUMNS.filter((c) => textOf(row, c).trim());
  const notes = textOf(row, 'notes').trim();
  const fields = [...partsOf(index, id, 'entity_field'), ...partsOf(index, id, 'event_field')];
  const steps = partsOf(index, id, 'use_case_step');
  const shapes = partsOf(index, id, 'api_shape');
  const roles = partsOf(index, id, 'role');
  const empty = lead.length + titled.length + scenario.length + fields.length + steps.length + shapes.length + roles.length === 0 && !notes;
  return (
    <div className="record-text">
      {empty && <p className="hint">No text yet.</p>}
      {lead.map((c) => <div key={c} className="record-lead" data-field={c}><Prose index={index} source={textOf(row, c)} self={id} /></div>)}
      {scenario.length > 0 && (
        <dl className="scenario" aria-label="Scenario">
          {scenario.map((c) => (
            <div key={c} data-field={c}><dt>{c[0].toUpperCase() + c.slice(1)}</dt><dd><Prose index={index} source={textOf(row, c)} self={id} /></dd></div>
          ))}
        </dl>
      )}
      {steps.length > 0 && (
        <Section title="Steps" count={steps.length}>
          <ol className="use-case-steps">
            {steps.map((s) => <li key={String(s.position)}><Prose index={index} source={textOf(s, 'description')} self={id} /></li>)}
          </ol>
        </Section>
      )}
      {fields.length > 0 && <FieldsTable rows={fields} owner={id} />}
      {shapes.length > 0 && (
        <Section title="Shapes" count={shapes.length}>
          <div className="table-scroll">
            <table className="data-table api-shapes">
              <caption className="sr-only">The shapes of {id}</caption>
              <thead><tr><th scope="col">Shape</th><th scope="col">Meaning</th><th scope="col">Fields</th></tr></thead>
              <tbody>{shapes.map((s) => <tr key={String(s.position)}><th scope="row">{textOf(s, 'name')}</th><td>{textOf(s, 'meaning')}</td><td>{textOf(s, 'fields')}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>
      )}
      {roles.length > 0 && (
        <Section title="Roles" count={roles.length}>
          <dl className="fields roles">
            {roles.map((r) => <div key={textOf(r, 'name')}><dt>{textOf(r, 'name')}</dt><dd>{textOf(r, 'description') || <span className="hint">No description.</span>}</dd></div>)}
          </dl>
        </Section>
      )}
      {titled.map((c) => (
        <Section key={c.column} title={c.title}>
          <Prose index={index} source={textOf(row, c.column)} self={id} />
        </Section>
      ))}
      {notes && (
        <Section title="Notes" className="record-notes">
          <Prose index={index} source={notes} self={id} />
        </Section>
      )}
    </div>
  );
}

/** An entity's or a domain event's fields, as a table. */
function FieldsTable({ rows, owner }: { rows: Row[]; owner: string }) {
  const examples = rows.some((r) => textOf(r, 'example'));
  return (
    <Section title="Fields" count={rows.length}>
      <div className="table-scroll">
        <table className="data-table entity-fields">
          <caption className="sr-only">The fields of {owner}</caption>
          <thead><tr><th scope="col">Field</th><th scope="col">Meaning</th><th scope="col">Type</th>{examples && <th scope="col">Example</th>}</tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr key={String(f.position)}>
                <th scope="row">{textOf(f, 'name')}</th>
                <td>{textOf(f, 'meaning')}</td>
                <td>{textOf(f, 'type')}</td>
                {examples && <td>{textOf(f, 'example')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** One fact of a record: its column (null for one made of several), its label and its value. */
export interface Fact {
  column: string | null;
  label: string;
  value: ReactNode;
}

/**
 * A record's short fields, as facts: every column of its kind's table that is not its ID, title,
 * a parent or a text field, in the table's order; then what its part rows say in brief (a use
 * case's actors, the settings it gives a pattern). A test's state is left to the caller, which
 * shows it with its tag.
 */
export function factsOf(index: SpecIndex, record: SpecRecord): Fact[] {
  const { schema } = index.workspace;
  const skip = new Set(['id', 'title', ...parentColumns(schema, record.kind), ...TEXT_COLUMNS, ...APPLIES_WHEN_COLUMNS]);
  if (record.kind === 'test') skip.add('state');
  const facts: Fact[] = (schema.tables[record.kind]?.columns ?? [])
    .filter((c) => !skip.has(c.name) && record.row[c.name] !== undefined)
    .map((c) => ({ column: c.name, label: label(c.name), value: textOf(record.row, c.name) }));
  const condition = record.kind === 'pattern_rule' ? appliesWhenOf(record) : null;
  if (condition) facts.push({ column: null, label: 'applies when', value: appliesWhenText(condition) });
  const actors = partsOf(index, record.id, 'use_case_actor').map((a) => textOf(a, 'role_name'));
  if (actors.length > 0) facts.push({ column: null, label: actors.length === 1 ? 'actor' : 'actors', value: actors.join(', ') });
  for (const v of partsOf(index, record.id, 'setting_value')) {
    facts.push({ column: null, label: textOf(v, 'setting'), value: settingText(settingOfRow(v)) });
  }
  // Part rows of a product's own tables, or any the page does not lay out, are counted.
  for (const [table, rows] of index.parts.get(record.id) ?? []) {
    if (SHOWN_PARTS.has(table) || table === 'use_case_actor' || table === 'setting_value') continue;
    facts.push({ column: null, label: label(table), value: `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}` });
  }
  return facts;
}

/** Where a record's row is: its data file and line, as `data/use_case.jsonl:12`. */
export const rowPlace = (record: SpecRecord) => `${record.file}:${record.line}`;
