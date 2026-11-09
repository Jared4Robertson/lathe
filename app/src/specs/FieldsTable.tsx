import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { RecordLink, Section } from './parts';
import { TableScroll } from '../components/TableScroll';

// The fields of an entity, a value object, a domain event or a read model, as their aggregates' pages show them: a
// table of each field's name, meaning, type (a basic type, a value object or a reference to an aggregate), whether it
// is required, its column and an example. Each page passes the fields its own read model gives.

/** One field as its aggregate's read model gives it. */
export interface FieldRow {
  name: string;
  meaning?: string | null;
  type?: string | null;
  type_value_object_id?: string | null;
  type_aggregate_id?: string | null;
  required?: boolean | null;
  column_name?: string | null;
  example?: string | null;
}

/** A field's type: its basic type, the value object it is (a link), or the aggregate it refers to (a link, with an arrow). */
export function FieldType({ index, field }: { index: RecordIndex; field: FieldRow }) {
  if (field.type_value_object_id) return <RecordLink index={index} id={field.type_value_object_id} />;
  if (field.type_aggregate_id) return <span className="field-reference" title="A reference to an aggregate, by its ID">→ <RecordLink index={index} id={field.type_aggregate_id} /></span>;
  return <>{field.type ?? ''}</>;
}

/** The fields as a table: name, meaning, type, whether required, and the column and example when any field gives one. */
export function FieldsTable({ index, rows, owner }: { index: RecordIndex; rows: readonly FieldRow[]; owner: string }) {
  const examples = rows.some((r) => r.example);
  const columns = rows.some((r) => r.column_name);
  return (
    <Section title="Fields" count={rows.length}>
      {/* Where its columns can't all fit, as in the narrow wiki card, each field's row stacks (LA-PAT-APP-UX-R18). */}
      <TableScroll stack>
        <table className="data-table entity-fields" role="table">
          <caption className="sr-only">The fields of {owner}</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Field</th><th scope="col" role="columnheader">Meaning</th><th scope="col" role="columnheader">Type</th><th scope="col" role="columnheader">Required</th>
              {columns && <th scope="col" role="columnheader">Column</th>}
              {examples && <th scope="col" role="columnheader">Example</th>}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((f, i) => (
              <tr key={`${i}-${f.name}`} role="row">
                <th scope="row" role="rowheader">{f.name}</th>
                <td role="cell" data-label="Meaning">{f.meaning ?? ''}</td>
                <td role="cell" data-label="Type"><FieldType index={index} field={f} /></td>
                <td role="cell" data-label="Required">{f.required === true ? 'yes' : 'no'}</td>
                {columns && <td role="cell" data-label="Column">{f.column_name && <code>{f.column_name}</code>}</td>}
                {examples && <td role="cell" data-label="Example">{f.example ?? ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  );
}
