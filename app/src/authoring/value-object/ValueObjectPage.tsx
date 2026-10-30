import type { ValueObjectPage as ValueObject } from '../../../../lathe/src/authoring/value-object/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Rows, RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { Prose } from '../../specs/mentions';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { FieldsTable } from '../../specs/FieldsTable';
import { ValueObjectEditor } from './ValueObjectEditor';
import { useValueObject } from './reads';

// The Value object page (LA-AUT-A9's page, LA-V142): any record of a value object, at its address (/<id>), drawn from
// the value object read whole (GET /api/value-object/get-value-object) and changed only through its own commands
// (ValueObjectEditor). A value object shows its description, its fields in order with their types, its constraints in
// a table with the test that proves each, and its value type; a constraint its statement and its test; a constraint
// test the values it accepts and refuses; what a value type meets and the packages it uses are among the links and facts. What every
// record's page holds around that (traceability, problems, facts and links) is the Record page's (RecordFrame).

/** The value object's constraints in a table, one row each with the test that proves it. */
function Constraints({ index, page }: { index: RecordIndex; page: ValueObject }) {
  return (
    <Section title="Constraints" count={page.constraints.length}>
      {page.constraints.length === 0 ? <p className="hint">No constraints yet.</p> : (
        <div className="table-scroll table-stack">
          <table className="data-table value-object-constraints" role="table">
            <caption className="sr-only">The constraints of {page.valueObject.id}, with the test that proves each</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Constraint</th><th scope="col" role="columnheader">Proved by</th></tr></thead>
            <tbody role="rowgroup">
              {page.constraints.map((c) => (
                <tr key={c.constraint.id} role="row">
                  <th scope="row" role="rowheader"><RecordLink index={index} id={c.constraint.id} /></th>
                  <td role="cell" data-label="Proved by">{c.test ? <RecordLink index={index} id={c.test.test.id} showTitle={false} /> : <span className="hint">Nothing yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const constraintOf = (page: ValueObject, id: string) => page.constraints.find((c) => c.constraint.id === id)!;
const testOf = (page: ValueObject, id: string) => page.constraints.find((c) => c.test?.test.id === id)!.test!;

/** What one record of the value object shows on its page, by the kind it is in the value object. */
function Content({ index, page }: { index: RecordIndex; page: ValueObject }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'value_object':
      return (
        <>
          <Text index={index} id={id} source={page.valueObject.description} field="description" />
          {page.fields.length === 0 ? <Section title="Fields" count={0}><p className="hint">No fields yet.</p></Section>
            : <FieldsTable index={index} rows={page.fields} owner={id} />}
          <Constraints index={index} page={page} />
          <RowsSection index={index} title="Value type" ids={page.valueType ? [page.valueType.valueType.id] : []} label={`The value type of ${id}`} empty="Its value type is not written yet." />
        </>
      );
    case 'constraint': {
      const { constraint, test } = constraintOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={constraint.statement} field="statement" />
          <RowsSection index={index} title="Test" ids={test ? [test.test.id] : []} label={`The test of ${id}`} empty="Its test is not written yet." />
        </>
      );
    }
    case 'value_type':
      // A value type is a name in code and its file: its facts and links (what it meets, the packages it uses) are the frame's.
      return null;
    case 'constraint_test': {
      const { test, startsFrom } = testOf(page, id);
      return (
        <>
          <dl className="scenario" aria-label="Scenario">
            <div data-field="accepts"><dt>Accepts</dt><dd><Prose index={index} source={test.accepts} self={id} /></dd></div>
            <div data-field="refuses"><dt>Refuses</dt><dd><Prose index={index} source={test.refuses} self={id} /></dd></div>
          </dl>
          <Text index={index} id={id} source={test.notes} title="Notes" field="notes" />
          {startsFrom.length > 0 && <Section title="Starts from" count={startsFrom.length} level={3}><Rows index={index} ids={startsFrom} label={`Test data sets ${id} starts from`} /></Section>}
        </>
      );
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: ValueObject): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const valueObject = <RecordLink index={index} id={page.valueObject.id} />;
  switch (kind) {
    case 'value_object':
      return { lead: page.valueObject.description, facts: [{ label: 'Fields', value: page.fields.length }, { label: 'Constraints', value: page.constraints.length }, { label: 'Value type', value: page.valueType ? 'written' : 'not yet' }] };
    case 'constraint': {
      const c = constraintOf(page, id);
      return { lead: c.constraint.statement, facts: [{ label: 'Value object', value: valueObject }, { label: 'Test', value: c.test ? c.test.test.state : 'not yet' }] };
    }
    case 'value_type':
      return { facts: [{ label: 'Value object', value: valueObject }, { label: 'File', value: page.valueType!.valueType.file ? <code>{page.valueType!.valueType.file}</code> : '—' }, { label: 'Meets', value: page.valueType!.meets.length }] };
    case 'constraint_test': {
      const { test } = testOf(page, id);
      return { lead: test.accepts, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.constraint_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of a value object: its page (or its summary in the wiki card), with its editor's actions. */
export function ValueObjectPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useValueObject(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <ValueObjectEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="value-object">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </ValueObjectEditor>
  );
}
