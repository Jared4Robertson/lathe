import type { GeneratedComponentPage as GeneratedComponent } from '../../../../lathe/src/domain-modeling/generated-component/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { GeneratedComponentEditor } from './GeneratedComponentEditor';
import { useGeneratedComponent } from './reads';

// The Generated component page (LA-MOD-A25's page, LA-V159): a generated component at its address (/<id>), drawn from its page read through the aggregate's
// own query (GET /api/generated-component/get-generated-component, read model LA-MOD-RM45) and changed only through its own commands (GeneratedComponentEditor):
// its description, then the guarantees it makes, each a row leading to it, or that none is written yet; the business
// outcomes it serves are among its links. What every record's page holds around that (traceability, problems, facts and
// links) is the Record page's (RecordFrame).

/** The generated component's description and the guarantees it makes. */
function Content({ index, page }: { index: RecordIndex; page: GeneratedComponent }) {
  const { id, description } = page.generatedComponent;
  return (
    <>
      <Text index={index} id={id} source={description} field="description" />
      <RowsSection index={index} title="Guarantees" ids={page.guarantees.map((g) => g.id)} label={`The guarantees ${id} makes`} empty="The guarantees it makes are not written yet." />
    </>
  );
}

/** The generated component's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: GeneratedComponent): { lead?: string; facts: Fact[] } {
  return {
    lead: page.generatedComponent.description,
    facts: [
      { label: 'Domain', value: <RecordLink index={index} id={page.generatedComponent.domain_id} /> },
      { label: 'Guarantees', value: page.guarantees.length },
      { label: 'Serves', value: page.serves.length },
    ],
  };
}

/** A generated component: its page (or its summary in the wiki card), with its editor's actions. */
export function GeneratedComponentPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useGeneratedComponent(id, index);
  const state = readState(index, id, read, (answer) => answer.generatedComponent.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <GeneratedComponentEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="generated-component">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </GeneratedComponentEditor>
  );
}
