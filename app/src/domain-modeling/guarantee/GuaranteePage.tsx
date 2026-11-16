import type { GuaranteePage as Guarantee } from '../../../../lathe/src/domain-modeling/guarantee/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { GuaranteeEditor } from './GuaranteeEditor';
import { useGuarantee } from './reads';

// The Guarantee page (LA-MOD-A24's page, LA-V158): a guarantee or one of its tests, at its address (/<id>), drawn from
// the guarantee read whole (GET /api/guarantee/get-guarantee) and changed only through its own commands
// (GuaranteeEditor). A guarantee shows its maker, its statement, whom it is for when a generated component or a library
// makes it (its consumers, or that it names no one yet), and its guarantee tests (or that none is written yet), the
// building blocks that keep it among its links (Kept by); a guarantee test its scenario and what it starts from. What
// every record's page holds around that (traceability, problems, facts and links) is the Record page's (RecordFrame).

/** What one record of the guarantee shows on its page, by the kind it is in the guarantee. */
function Content({ index, page }: { index: RecordIndex; page: Guarantee }) {
  const { id, kind } = page.record;
  if (kind === 'guarantee_test') {
    const { test, startsFrom } = page.tests.find((t) => t.test.id === id)!;
    return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
  }
  const outside = page.maker.kind !== 'domain';
  return (
    <>
      <dl className="fields">
        <div data-field="maker"><dt>Maker</dt><dd><RecordLink index={index} id={page.maker.id} /></dd></div>
        {outside && <div data-field="consumers"><dt>Consumers</dt><dd>{page.guarantee.consumers ?? <span className="hint">It names no one yet.</span>}</dd></div>}
      </dl>
      <Text index={index} id={id} source={page.guarantee.statement} field="statement" />
      <RowsSection index={index} title="Guarantee tests" ids={page.tests.map((t) => t.test.id)} label={`The guarantee tests of ${id}`} empty="Its guarantee tests are not written yet." />
    </>
  );
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Guarantee): { lead?: string; facts: Fact[] } {
  if (page.record.kind === 'guarantee_test') {
    const { test } = page.tests.find((t) => t.test.id === page.record.id)!;
    return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={page.guarantee.id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
  }
  return {
    lead: page.guarantee.statement,
    facts: [
      { label: 'Maker', value: <RecordLink index={index} id={page.maker.id} /> },
      { label: 'Kept by', value: page.keptBy.length },
      { label: 'Guarantee tests', value: page.tests.length },
    ],
  };
}

/** A record of a guarantee: its page (or its summary in the wiki card), with its editor's actions. */
export function GuaranteePage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useGuarantee(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <GuaranteeEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="guarantee">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </GuaranteeEditor>
  );
}
