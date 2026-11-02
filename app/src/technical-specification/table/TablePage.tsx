import type { TablePage as Table } from '../../../../lathe/src/technical-specification/table/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Summary, readState, type Fact } from '../../record/page-parts';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { TableEditor } from './TableEditor';
import { useTable } from './reads';

// The Table page (LA-TEC-A18's page, LA-V140): a table at its address (/<id>), drawn from the table read whole
// (GET /api/table/get-table) and changed only through its own commands (TableEditor): its keys in order, each with its
// type, its columns and what it enforces, references or holds where; what it meets and the packages it uses are among
// the links and facts. What every record's page holds around that (traceability, problems, facts and links) is the Record page's
// (RecordFrame).

/** The table's keys and indexes in order: the primary key, unique keys with the invariant each enforces and its condition, foreign keys with their target, and indexes. */
function Keys({ index, page }: { index: RecordIndex; page: Table }) {
  return (
    <Section title="Keys" count={page.keys.length} className="table-keys-section">
      {page.keys.length === 0 ? <p className="hint">No keys: {page.table.storage === 'table' ? 'a table in a database names its primary key here.' : `a table kept as ${page.table.storage} has none.`}</p> : (
        <div className="table-scroll table-stack">
          <table className="data-table table-keys" role="table">
            <caption className="sr-only">The keys and indexes of {page.table.id}</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Key</th><th scope="col" role="columnheader">Type</th><th scope="col" role="columnheader">Columns</th><th scope="col" role="columnheader">Details</th></tr></thead>
            <tbody role="rowgroup">
              {page.keys.map((k) => (
                <tr key={k.position} role="row">
                  <th scope="row" role="rowheader">{k.name || <span className="hint">unnamed</span>}</th>
                  <td role="cell" data-label="Type">{k.type}</td>
                  <td role="cell" data-label="Columns"><code>{k.columns.join(', ')}</code></td>
                  <td role="cell" data-label="Details">
                    {/* One cell's worth of details, so a stacked row keeps them together beside their label. */}
                    <span className="key-details">
                      {k.invariant_id && <span className="key-detail">enforces <RecordLink index={index} id={k.invariant_id} showTitle={false} /></span>}
                      {k.target_table_id && <span className="key-detail">references <RecordLink index={index} id={k.target_table_id} showTitle={false} /></span>}
                      {k.condition && <span className="key-detail">where <code>{k.condition}</code></span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** The table's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Table): { lead?: string; facts: Fact[] } {
  const stores = { entity: 'Stores', read_model: 'Stores', domain: 'Domain' }[page.parent.kind];
  return {
    facts: [
      { label: stores, value: <RecordLink index={index} id={page.parent.id} /> },
      { label: 'Name', value: <code>{page.table.name}</code> },
      { label: 'Storage', value: page.table.storage },
      { label: 'Keys', value: page.keys.length },
    ],
  };
}

/** A table: its page (or its summary in the wiki card), with its editor's actions. */
export function TablePage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useTable(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <TableEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="table">
          <RecordFrame index={index} record={index.byId.get(id)!}><Keys index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </TableEditor>
  );
}
