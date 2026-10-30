import type { DataStorePage as Store } from '../../../../lathe/src/authoring/data-store/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { DataStoreEditor } from './DataStoreEditor';
import { useDataStore } from './reads';

// The Data store page (LA-AUT-A23's page): a data store at its address (/<id>), drawn from its page read through the
// aggregate's own query (GET /api/data-store/get-data-store, read model LA-AUT-RM43) and changed only through its own
// commands (DataStoreEditor): its description, its kind, the product or domain it sits under, the integration that
// reaches it, and the repositories, readers and tables stored in it. What every record's page holds around that
// (traceability, problems, facts and links) is the Record page's (RecordFrame).

/** What the page draws itself from its read, which its Traceability leaves out: what is stored in it, and what provides it. */
const SHOWN: ReadonlySet<string> = new Set(['in:stored_in', 'out:provided_by']);

/** The data store's kind, where it sits and what reaches it. */
const factsOf = (index: RecordIndex, page: Store): Fact[] => [
  { label: 'Kind', value: page.store.kind },
  { label: 'Under', value: <RecordLink index={index} id={page.parent.id} /> },
  ...(page.providedBy ? [{ label: 'Provided by', value: <RecordLink index={index} id={page.providedBy.id} /> }] : []),
];

/** The data store's description, facts and what it stores. */
function Content({ index, page }: { index: RecordIndex; page: Store }) {
  const { id } = page.store;
  return (
    <>
      <Text index={index} id={id} source={page.store.description} field="description" />
      <Facts facts={factsOf(index, page)} />
      <RowsSection index={index} title="Stores" ids={page.stores.map((s) => s.id)} label={`What ${id} stores`} empty="Nothing is stored in it yet." className="data-store-stores" />
    </>
  );
}

/** A data store: its page (or its summary in the wiki card), with its editor's actions. */
export function DataStorePage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useDataStore(id, index);
  const state = readState(index, id, read, (answer) => answer.store.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <DataStoreEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary lead={page.store.description} facts={[...factsOf(index, page), { label: 'Stores', value: page.stores.length }]} />{after}</div>
      ) : (
        <div className={body} data-aggregate="data-store">
          <RecordFrame index={index} record={index.byId.get(id)!} skip={SHOWN}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </DataStoreEditor>
  );
}
