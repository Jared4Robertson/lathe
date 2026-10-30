import type { SpecificationPage as Specification } from '../../../../lathe/src/authoring/specification/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { SpecificationEditor } from './SpecificationEditor';
import { useSpecification } from './reads';

// The Specification page (LA-AUT-A5's page, LA-V141): any record of a specification, at its address (/<id>), drawn
// from the specification read whole (GET /api/specification/get-specification) and changed only through its own
// commands (SpecificationEditor). A specification shows its statement and its predicate and test (or that they are
// not written yet); a specification test its scenario and what it starts from; the aggregates it reads, what a
// predicate meets and the packages it uses are among the links and facts. What every record's page holds around that (traceability,
// problems, facts and links) is the Record page's (RecordFrame).

/** What one record of the specification shows on its page, by the kind it is in the specification. */
function Content({ index, page }: { index: RecordIndex; page: Specification }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'specification':
      return (
        <>
          <Text index={index} id={id} source={page.specification.statement} field="statement" />
          <RowsSection index={index} title="Predicate" ids={page.predicate ? [page.predicate.predicate.id] : []} label={`The predicate of ${id}`} empty="Its predicate is not written yet." />
          <RowsSection index={index} title="Test" ids={page.test ? [page.test.test.id] : []} label={`The test of ${id}`} empty="Its test is not written yet." />
        </>
      );
    case 'predicate':
      // A predicate is a name in code and its file: its facts and links (what it meets, the packages it uses) are the frame's.
      return null;
    case 'specification_test': {
      const { test, startsFrom } = page.test!;
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Specification): { lead?: string; facts: Fact[] } {
  const spec = <RecordLink index={index} id={page.specification.id} />;
  switch (page.record.kind) {
    case 'specification':
      return {
        lead: page.specification.statement,
        facts: [
          { label: 'Domain', value: page.domain ? <RecordLink index={index} id={page.domain} /> : '—' },
          { label: 'Reads', value: page.reads.length },
          { label: 'Predicate', value: page.predicate ? 'written' : 'not yet' },
          { label: 'Test', value: page.test ? page.test.test.state : 'not yet' },
        ],
      };
    case 'predicate':
      return { facts: [{ label: 'Specification', value: spec }, { label: 'File', value: page.predicate!.predicate.file ? <code>{page.predicate!.predicate.file}</code> : '—' }, { label: 'Meets', value: page.predicate!.meets.length }] };
    case 'specification_test':
      return { lead: page.test!.test.when, facts: [{ label: 'Proves', value: spec }, { label: 'Level', value: page.test!.test.level }, { label: 'State', value: page.test!.test.state }] };
  }
}

/** A record of a specification: its page (or its summary in the wiki card), with its editor's actions. */
export function SpecificationPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useSpecification(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <SpecificationEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="specification">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </SpecificationEditor>
  );
}
