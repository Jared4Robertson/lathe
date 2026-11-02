import type { StorageRequirementPage as Requirement } from '../../../../lathe/src/domain-modeling/storage-requirement/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { StorageRequirementEditor } from './StorageRequirementEditor';
import { useStorageRequirement } from './reads';

// The Storage requirement page (LA-MOD-A22's page): any record of a storage requirement, at its address (/<id>), drawn
// from the storage requirement read whole (GET /api/storage-requirement/get-storage-requirement, read model
// LA-MOD-RM42) and changed only through its own commands (StorageRequirementEditor). A storage requirement shows its
// statement, what it is about, what builds it (its aggregate's repository or its read model's reader, with the data
// store it names) and its tests; a test its scenario and what it starts from. What every record's page holds around
// that (traceability, problems, facts and links) is the Record page's (RecordFrame).

/** What builds the requirement: the repository or reader, and where it stores its data. */
function builtBy(index: RecordIndex, page: Requirement): Fact[] {
  const { builder } = page;
  if (!builder) return [{ label: 'Built by', value: 'nothing yet: its aggregate has no repository, or its read model no reader' }];
  return [
    { label: 'Built by', value: <RecordLink index={index} id={builder.id} /> },
    { label: 'Stored in', value: builder.storedIn ? <RecordLink index={index} id={builder.storedIn.id} /> : 'no data store named yet' },
  ];
}

/** What one record of the storage requirement shows on its page, by the kind it is in it. */
function Content({ index, page }: { index: RecordIndex; page: Requirement }) {
  const { id, kind } = page.record;
  if (kind === 'storage_requirement_test') {
    const { test, startsFrom } = page.tests.find((t) => t.test.id === id)!;
    return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
  }
  return (
    <>
      <Text index={index} id={id} source={page.requirement.statement} field="statement" />
      <Facts facts={[{ label: 'About', value: <RecordLink index={index} id={page.parent.id} /> }, ...builtBy(index, page)]} />
      <RowsSection index={index} title="Tests" ids={page.tests.map((t) => t.test.id)} label={`Tests of ${id}`} empty="No test proves it yet." />
    </>
  );
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Requirement): { lead?: string; facts: Fact[] } {
  if (page.record.kind === 'storage_requirement_test') {
    const { test } = page.tests.find((t) => t.test.id === page.record.id)!;
    return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={page.requirement.id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
  }
  return { lead: page.requirement.statement, facts: [{ label: 'About', value: <RecordLink index={index} id={page.parent.id} /> }, ...builtBy(index, page).slice(0, 1), { label: 'Tests', value: page.tests.length }] };
}

/** A record of a storage requirement: its page (or its summary in the wiki card), with its editor's actions. */
export function StorageRequirementPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useStorageRequirement(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <StorageRequirementEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="storage-requirement">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </StorageRequirementEditor>
  );
}
