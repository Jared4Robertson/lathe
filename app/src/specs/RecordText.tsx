import type { ReactNode } from 'react';
import { LEAD_COLUMNS } from '../../../lathe/src/lead';
import { parentColumns, partsOf, textOf, type Row, type SpecIndex, type SpecRecord } from './data';
import { Prose } from './mentions';
import { RecordLink, Section, isTestKind } from './parts';
import { appliesWhenOf, appliesWhenText, settingOfRow, settingText } from './patterns';

// A record's typed fields, in place of a Markdown body: its text fields (a rule's statement, a use
// case's goal, a term's meaning, a test's When and Then, an outcome's measure, target and measure outside the code, a
// test data set's environment and setup, the notes) on the page, read as Markdown, and its short
// fields (a route, a method, a file, a level) as facts beside it. Its part rows show too: the fields of an entity, a value object, a domain event or a read model as a table,
// each with its type (a basic type, a value object or a reference to an aggregate); a table's keys;
// a command's recorded exceptions; a flow test's steps; a product's roles.

/** Text columns shown under their own heading, after the lead. */
const TITLED_COLUMNS: readonly { column: string; title: string }[] = [
  { column: 'identity', title: 'Identity' },
  { column: 'expected_result', title: 'Expected result' },
  // A business outcome's measure and target, and how it is measured outside the code when nothing in it can.
  { column: 'measure', title: 'Measure' },
  { column: 'target', title: 'Target' },
  { column: 'measured_outside', title: 'Measured outside the code' },
  // A test data set: where it runs, what it starts with, and how to prepare and reset it.
  { column: 'environment', title: 'Environment' },
  { column: 'accounts', title: 'Accounts' },
  { column: 'records', title: 'Starting records' },
  { column: 'prepare', title: 'Prepare' },
  { column: 'reset', title: 'Reset' },
];
/** A test's scenario, shown together: When and Then, or what a constraint accepts and refuses. */
const SCENARIO_COLUMNS = ['when', 'then', 'accepts', 'refuses'] as const;
/** Every column the page shows as text; the rest of a record's columns are facts. */
export const TEXT_COLUMNS: ReadonlySet<string> = new Set([...LEAD_COLUMNS, ...TITLED_COLUMNS.map((c) => c.column), ...SCENARIO_COLUMNS, 'notes', 'reason', 'manual_reason']);
/** A pattern rule's applies-when columns read as one fact. */
const APPLIES_WHEN_COLUMNS: ReadonlySet<string> = new Set(['applies_when_setting', 'applies_when_negated', 'applies_when_value']);
/** A test's run by, which its Traceability shows. */
const RUN_BY_COLUMNS: ReadonlySet<string> = new Set(['level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external']);

const label = (column: string) => column.replaceAll('_', ' ');

/** The part tables with a field's shape: a name, a meaning and one type. */
export const FIELD_TABLES = ['entity_field', 'value_object_field', 'event_field', 'read_model_field'] as const;

/** The part tables a record's page lays out itself, in place of listing their rows as facts. */
const SHOWN_PARTS: ReadonlySet<string> = new Set([...FIELD_TABLES, 'table_key', 'command_change', 'repository_share', 'pattern_setting', 'role', 'use_case_actor', 'setting_value', 'package_use']);

const scenarioLabel = (c: string) => c[0].toUpperCase() + c.slice(1);

/** The record's text fields and part rows, for the body of its page. */
/** A record's lead text: the one lead column its kind has (LEAD_COLUMNS); empty for a kind with none. */
export const leadOf = (record: SpecRecord): string => LEAD_COLUMNS.map((c) => textOf(record.row, c).trim()).find((t) => t) ?? '';

export function RecordText({ index, record }: { index: SpecIndex; record: SpecRecord }) {
  const { row, id } = record;
  const lead = LEAD_COLUMNS.filter((c) => textOf(row, c).trim());
  const titled = TITLED_COLUMNS.filter((c) => textOf(row, c.column).trim());
  const scenario = SCENARIO_COLUMNS.filter((c) => textOf(row, c).trim());
  const notes = textOf(row, 'notes').trim();
  const fields = FIELD_TABLES.flatMap((t) => partsOf(index, id, t));
  const keys = partsOf(index, id, 'table_key');
  const changes = partsOf(index, id, 'command_change');
  const shares = partsOf(index, id, 'repository_share');
  const steps = Array.isArray(row.steps) ? row.steps : [];
  const roles = partsOf(index, id, 'role');
  // A kind with no lead, scenario or parts, such as a flow, has no text of its own (LA-STD-MODELING-R10): nothing to show.
  if (lead.length + titled.length + scenario.length + fields.length + keys.length + changes.length + shares.length + steps.length + roles.length === 0 && !notes) return null;
  return (
    <div className="record-text">
      {lead.map((c) => <div key={c} className="record-lead" data-field={c}><Prose index={index} source={textOf(row, c)} self={id} /></div>)}
      {scenario.length > 0 && (
        <dl className="scenario" aria-label="Scenario">
          {scenario.map((c) => (
            <div key={c} data-field={c}><dt>{scenarioLabel(c)}</dt><dd><Prose index={index} source={textOf(row, c)} self={id} /></dd></div>
          ))}
        </dl>
      )}
      {steps.length > 0 && (
        <Section title="Steps" count={steps.length}>
          <ol className="test-steps">
            {steps.map((s, i) => <li key={i}><Prose index={index} source={s} self={id} /></li>)}
          </ol>
        </Section>
      )}
      {fields.length > 0 && <FieldsTable index={index} rows={fields} owner={id} />}
      {keys.length > 0 && <KeysTable index={index} rows={keys} owner={id} />}
      {changes.length > 0 && (
        <RecordedExceptions index={index} rows={changes} owner={id} title="Also changes"
          hint="A recorded exception to one aggregate per command: each is changed in the same transaction, and the checks list it so it stays deliberate." />
      )}
      {shares.length > 0 && (
        <RecordedExceptions index={index} rows={shares} owner={id} title="Also persists"
          hint="A recorded exception to one repository per aggregate: each has no repository of its own, and the checks list it so it stays deliberate." />
      )}
      {roles.length > 0 && (
        <Section title="Roles" count={roles.length}>
          <dl className="fields roles">
            {roles.map((r) => <div key={textOf(r, 'name')}><dt>{textOf(r, 'name')}</dt><dd>{textOf(r, 'description')}</dd></div>)}
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

/** A field's type: its basic type, the value object it is (a link), or the aggregate it refers to (a link, with an arrow). */
export function FieldType({ index, field }: { index: SpecIndex; field: Row }) {
  const valueObject = textOf(field, 'type_value_object_id');
  const aggregate = textOf(field, 'type_aggregate_id');
  if (valueObject) return <RecordLink index={index} id={valueObject} />;
  if (aggregate) return <span className="field-reference" title="A reference to an aggregate, by its ID">→ <RecordLink index={index} id={aggregate} /></span>;
  return <>{textOf(field, 'type')}</>;
}

/** The fields of an entity, a value object, a domain event or a read model, as a table: name, meaning, type, whether required, and example. */
export function FieldsTable({ index, rows, owner }: { index: SpecIndex; rows: Row[]; owner: string }) {
  const examples = rows.some((r) => textOf(r, 'example'));
  const columns = rows.some((r) => textOf(r, 'column_name'));
  return (
    <Section title="Fields" count={rows.length}>
      <div className="table-scroll">
        <table className="data-table entity-fields">
          <caption className="sr-only">The fields of {owner}</caption>
          <thead>
            <tr>
              <th scope="col">Field</th><th scope="col">Meaning</th><th scope="col">Type</th><th scope="col">Required</th>
              {columns && <th scope="col">Column</th>}
              {examples && <th scope="col">Example</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={String(f.position)}>
                <th scope="row">{textOf(f, 'name')}</th>
                <td>{textOf(f, 'meaning')}</td>
                <td><FieldType index={index} field={f} /></td>
                <td>{f.required === true ? 'yes' : 'no'}</td>
                {columns && <td>{textOf(f, 'column_name') && <code>{textOf(f, 'column_name')}</code>}</td>}
                {examples && <td>{textOf(f, 'example')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** A table's keys and indexes: the primary key, unique keys (with the invariant each enforces and its condition), foreign keys (with their target table) and indexes. */
function KeysTable({ index, rows, owner }: { index: SpecIndex; rows: Row[]; owner: string }) {
  return (
    <Section title="Keys" count={rows.length}>
      <div className="table-scroll">
        <table className="data-table table-keys">
          <caption className="sr-only">The keys and indexes of {owner}</caption>
          <thead><tr><th scope="col">Key</th><th scope="col">Type</th><th scope="col">Columns</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {rows.map((k) => {
              const invariant = textOf(k, 'invariant_id');
              const target = textOf(k, 'target_table_id');
              const condition = textOf(k, 'condition');
              return (
                <tr key={String(k.position)}>
                  <th scope="row">{textOf(k, 'name') || <span className="hint">unnamed</span>}</th>
                  <td>{textOf(k, 'type')}</td>
                  <td><code>{textOf(k, 'columns')}</code></td>
                  <td>
                    {invariant && <span className="key-detail">enforces <RecordLink index={index} id={invariant} /></span>}
                    {target && <span className="key-detail">references <RecordLink index={index} id={target} /></span>}
                    {condition && <span className="key-detail">where <code>{condition}</code></span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/**
 * A record's recorded exceptions, each another aggregate and why: those a command also changes in its transaction
 * (command_change), or those a repository also persists (repository_share).
 */
/** Recorded exceptions of a command or a repository: each other aggregate it also changes or persists, with its reason. */
export function RecordedExceptions({ index, rows, owner, title, hint }: { index: SpecIndex; rows: Row[]; owner: string; title: string; hint: string }) {
  return (
    <Section title={title} count={rows.length} className="recorded-exceptions">
      <p className="hint">{hint}</p>
      <dl className="fields">
        {rows.map((c) => (
          <div key={textOf(c, 'aggregate_id')}>
            <dt><RecordLink index={index} id={textOf(c, 'aggregate_id')} /></dt>
            <dd><Prose index={index} source={textOf(c, 'reason')} self={owner} /></dd>
          </div>
        ))}
      </dl>
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
 * a parent, a text field or a test's run by, in the table's order; then what its part rows say in
 * brief (a use case's actors, the settings it gives a pattern, how many rows of a product's own part
 * tables).
 */
export function factsOf(index: SpecIndex, record: SpecRecord): Fact[] {
  const { schema } = index.workspace;
  const skip = new Set(['id', 'title', ...parentColumns(schema, record.kind), ...TEXT_COLUMNS, ...APPLIES_WHEN_COLUMNS, 'steps']);
  if (isTestKind(index, record.kind)) for (const c of RUN_BY_COLUMNS) skip.add(c);
  const facts: Fact[] = (schema.tables[record.kind]?.columns ?? [])
    .filter((c) => !skip.has(c.name) && record.row[c.name] !== undefined)
    .map((c) => ({ column: c.name, label: label(c.name), value: c.name === 'domain_id' ? <RecordLink index={index} id={textOf(record.row, c.name)} /> : textOf(record.row, c.name) }));
  const condition = record.kind === 'pattern_rule' ? appliesWhenOf(record) : null;
  if (condition) facts.push({ column: null, label: 'applies when', value: appliesWhenText(condition) });
  const actors = partsOf(index, record.id, 'use_case_actor').map((a) => textOf(a, 'role_name'));
  if (actors.length > 0) facts.push({ column: null, label: actors.length === 1 ? 'actor' : 'actors', value: actors.join(', ') });
  const packages = partsOf(index, record.id, 'package_use').map((p) => textOf(p, 'package'));
  if (packages.length > 0) facts.push({ column: null, label: packages.length === 1 ? 'package' : 'packages', value: packages.join(', ') });
  for (const v of partsOf(index, record.id, 'setting_value')) {
    facts.push({ column: null, label: textOf(v, 'setting'), value: settingText(settingOfRow(v)) });
  }
  // Part rows of a product's own tables, or any the page does not lay out, are counted.
  for (const [table, rows] of index.parts.get(record.id) ?? []) {
    if (SHOWN_PARTS.has(table)) continue;
    facts.push({ column: null, label: label(table), value: `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}` });
  }
  return facts;
}

/** Where a record's row is: its data file and line, as `data/use_case.jsonl:12`. */
export const rowPlace = (record: SpecRecord) => `${record.file}:${record.line}`;
