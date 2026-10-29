import type { TestDataSetPage as DataSet } from '../../../../lathe/src/authoring/test-data-set/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Summary, Text, readState } from '../../record/page-parts';
import type { SpecIndex } from '../../specs/data';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { TestDataSetEditor } from './TestDataSetEditor';
import { useTestDataSet } from './reads';

// The Test data set page (LA-AUT-A17's page, LA-V121): a test data set at its address (/<id>), drawn from its page read
// through the aggregate's own query (GET /api/test-data-set/get-test-data-set) and changed only through its own
// commands (TestDataSetEditor): its description as the lead, then where it runs, the accounts it signs in as, the
// records it starts with, how to prepare and reset it, and the file that builds it. The tests that start from it are in
// its Traceability, which with the problems, facts and links is the Record page's (RecordFrame).

/** The data set's own texts, in their order. */
function Content({ index, page }: { index: SpecIndex; page: DataSet }) {
  const set = page.testDataSet;
  return (
    <>
      <Text index={index} id={set.id} source={set.description} field="description" />
      <Text index={index} id={set.id} source={set.environment} title="Environment" field="environment" />
      <Text index={index} id={set.id} source={set.accounts} title="Accounts" field="accounts" />
      <Text index={index} id={set.id} source={set.records} title="Starting records" field="records" />
      <Text index={index} id={set.id} source={set.prepare} title="Prepare" field="prepare" />
      <Text index={index} id={set.id} source={set.reset} title="Reset" field="reset" />
    </>
  );
}

/** A test data set: its page (or its summary in the wiki card), with its editor's actions. */
export function TestDataSetPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useTestDataSet(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  const count = page.startedFromBy.length;
  return (
    <TestDataSetEditor index={index} page={page}>
      {summary ? (
        <div className={body}>
          <Summary lead={page.testDataSet.description} facts={[
            { label: 'Domain', value: <RecordLink index={index} id={page.testDataSet.domain_id} /> },
            { label: 'Environment', value: page.testDataSet.environment },
            { label: 'Started from by', value: `${count} ${count === 1 ? 'test' : 'tests'}` },
          ]} />
          {after}
        </div>
      ) : (
        <div className={body} data-aggregate="test-data-set">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </TestDataSetEditor>
  );
}
