import type { CodeOnPage, ReadModelPage as ReadModel } from '../../../../lathe/src/domain-modeling/read-model/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { FieldsTable } from '../../specs/FieldsTable';
import { ReadModelEditor } from './ReadModelEditor';
import { useReadModel } from './reads';

// The Read model page (LA-MOD-A10's page, LA-V143): any record of a read model, at its address (/<id>), drawn from the
// read model read whole (GET /api/read-model/get-read-model) and changed only through its own commands
// (ReadModelEditor). A read model shows its description, its fields in order with their types, its queries in a table
// with each one's handler, and its projection and reader; a query its description and its handler; a projection, a
// reader or a query handler its description. What a record reads, calls, is fed by, selects by and meets, and the
// packages it uses, are among the links and facts. What every record's page holds around that (traceability, problems, facts and
// links) is the Record page's (RecordFrame).

/** The read model's queries in a table, one row each with its handler. */
function Queries({ index, page }: { index: RecordIndex; page: ReadModel }) {
  return (
    <Section title="Queries" count={page.queries.length}>
      {page.queries.length === 0 ? <p className="hint">No queries yet.</p> : (
        <div className="table-scroll table-stack">
          <table className="data-table read-model-queries" role="table">
            <caption className="sr-only">The queries of {page.readModel.id}, with each one's handler</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Query</th><th scope="col" role="columnheader">Handler</th></tr></thead>
            <tbody role="rowgroup">
              {page.queries.map((q) => (
                <tr key={q.query.id} role="row">
                  <th scope="row" role="rowheader"><RecordLink index={index} id={q.query.id} /></th>
                  <td role="cell" data-label="Handler">{q.handler ? <RecordLink index={index} id={q.handler.code.id} /> : <span className="hint">Nothing yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** A piece of code of the read model (its projection, its reader or a query handler): its description; what it meets and the packages it uses are among the links and facts. */
function Code({ index, id, code }: { index: RecordIndex; id: string; code: CodeOnPage<{ description: string }> }) {
  return <Text index={index} id={id} source={code.code.description} field="description" />;
}

const queryOf = (page: ReadModel, id: string) => page.queries.find((q) => q.query.id === id)!;
const handlerOf = (page: ReadModel, id: string) => page.queries.find((q) => q.handler?.code.id === id)!.handler!;

/** What one record of the read model shows on its page, by the kind it is in the read model. */
function Content({ index, page }: { index: RecordIndex; page: ReadModel }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'read_model':
      return (
        <>
          <Text index={index} id={id} source={page.readModel.description} field="description" />
          {page.fields.length === 0 ? <Section title="Fields" count={0}><p className="hint">No fields yet.</p></Section>
            : <FieldsTable index={index} rows={page.fields} owner={id} />}
          <Queries index={index} page={page} />
          <RowsSection index={index} title="Projection" ids={page.projection ? [page.projection.code.id] : []} label={`The projection of ${id}`} empty="Its projection is not written yet." />
          <RowsSection index={index} title="Reader" ids={page.reader ? [page.reader.code.id] : []} label={`The reader of ${id}`} empty="Its reader is not written yet." />
        </>
      );
    case 'query': {
      const q = queryOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={q.query.description} field="description" />
          <RowsSection index={index} title="Handler" ids={q.handler ? [q.handler.code.id] : []} label={`The handler of ${id}`} empty="Its handler is not written yet." />
        </>
      );
    }
    case 'projection':
      return <Code index={index} id={id} code={page.projection!} />;
    case 'reader':
      return <Code index={index} id={id} code={page.reader!} />;
    case 'query_handler':
      return <Code index={index} id={id} code={handlerOf(page, id)} />;
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: ReadModel): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const readModel = <RecordLink index={index} id={page.readModel.id} />;
  const code = (c: CodeOnPage<{ description: string; file?: string }>, label: string, parent: string): { lead?: string; facts: Fact[] } => ({
    lead: c.code.description,
    facts: [{ label, value: <RecordLink index={index} id={parent} /> }, { label: 'File', value: c.code.file ? <code>{c.code.file}</code> : '—' }, { label: 'Meets', value: c.meets.length }],
  });
  switch (kind) {
    case 'read_model':
      return { lead: page.readModel.description, facts: [{ label: 'Domain', value: <RecordLink index={index} id={page.readModel.domain_id} /> }, { label: 'Fields', value: page.fields.length }, { label: 'Queries', value: page.queries.length }] };
    case 'query': {
      const q = queryOf(page, id);
      return { lead: q.query.description, facts: [{ label: 'Read model', value: readModel }, { label: 'Handler', value: q.handler ? <RecordLink index={index} id={q.handler.code.id} /> : 'not yet' }] };
    }
    case 'projection':
      return code(page.projection!, 'Read model', page.readModel.id);
    case 'reader':
      return code(page.reader!, 'Read model', page.readModel.id);
    case 'query_handler': {
      const handler = handlerOf(page, id);
      return code(handler, 'Query', handler.code.query_id);
    }
  }
}

/** A record of a read model: its page (or its summary in the wiki card), with its editor's actions. */
export function ReadModelPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useReadModel(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <ReadModelEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="read-model">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </ReadModelEditor>
  );
}
