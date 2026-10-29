import type { UiComponentPage as UiComponent } from '../../../../lathe/src/authoring/ui-component/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Summary, Text, readState, type Fact } from '../../record/page-parts';
import { Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import type { SpecIndex } from '../../specs/data';
import { UiComponentEditor } from './UiComponentEditor';
import { useUiComponent } from './reads';

// The UI component page (LA-AUT-A15's page, LA-V151): a UI component at its address (/<id>), drawn from the UI
// component read whole (GET /api/ui-component/get-ui-component) and changed only through its own commands
// (UiComponentEditor): its description and the packages it uses. What every record's page holds around that (its
// Traceability with the views it renders and the standard rules it meets, problems, facts such as its file, and links)
// is the Record page's (RecordFrame); its editor changes them all.

/** The UI component's description and its packages. */
function Content({ index, page }: { index: SpecIndex; page: UiComponent }) {
  const { component } = page;
  return (
    <>
      <Text index={index} id={component.id} source={component.description} field="description" />
      {page.packages.length > 0 && (
        <Section title="Packages" count={page.packages.length} className="record-packages">
          <ul className="plain">{page.packages.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
        </Section>
      )}
    </>
  );
}

/** The UI component's lead and key facts in the wiki card. */
function summaryOf(page: UiComponent): { lead?: string; facts: Fact[] } {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return {
    lead: page.component.description,
    facts: [
      ...(page.component.file ? [{ label: 'File', value: <code>{page.component.file}</code> }] : []),
      { label: 'Renders', value: count(page.renders.length, 'view', 'views') },
      { label: 'Packages', value: page.packages.length },
    ],
  };
}

/** A UI component: its page (or its summary in the wiki card), with its editor's actions. */
export function UiComponentPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useUiComponent(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <UiComponentEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="ui-component">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </UiComponentEditor>
  );
}
