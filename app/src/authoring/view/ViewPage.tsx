import type { ViewPage as View, ViewRequirementOnPage } from '../../../../lathe/src/authoring/view/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { ViewEditor } from './ViewEditor';
import { useView } from './reads';

// The View page (LA-AUT-A12's page, LA-V150): any record of a view, at its address (/<id>), drawn from the view read
// whole (GET /api/view/get-view) and changed only through its own commands (ViewEditor). A view shows its description,
// its notes, and its requirements in a table under their groups, one row each with the tests that prove it; a view
// requirement its statement (its Traceability lists Proved by); a view test its scenario and what it starts from. What
// every record's page holds around that (traceability, problems, facts such as the view's route, and links) is the
// Record page's (RecordFrame).

/** A cell of record links, or a hint when there are none. */
function Ids({ index, ids }: { index: RecordIndex; ids: readonly string[] }) {
  return ids.length === 0 ? <span className="hint">Nothing yet</span> : (
    <span className="trace-cell">{ids.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}</span>
  );
}

/** The requirements under their groups: the ungrouped ones first, then each group in the order it first appears. */
function groupsOf(requirements: readonly ViewRequirementOnPage[]): { heading: string | null; requirements: ViewRequirementOnPage[] }[] {
  const groups = new Map<string, { heading: string | null; requirements: ViewRequirementOnPage[] }>();
  for (const r of requirements) {
    const heading = r.requirement.group_name?.trim() || null;
    const key = heading?.toLowerCase() ?? '';
    const group = groups.get(key) ?? { heading, requirements: [] };
    group.requirements.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, g]) => g);
}

/** The view's requirements in a table, one row each with the tests that prove it. */
function Requirements({ index, page }: { index: RecordIndex; page: View }) {
  return (
    <Section title="View requirements" count={page.requirements.length}>
      {page.requirements.length === 0 ? <p className="hint">No requirements yet.</p> : (
        <div className="table-scroll table-stack">
          <table className="data-table view-requirements" role="table">
            <caption className="sr-only">The requirements of {page.view.id}, with the tests that prove each one</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Requirement</th><th scope="col" role="columnheader">Proved by</th></tr></thead>
            {groupsOf(page.requirements).map((g) => (
              <tbody key={g.heading ?? ''} data-group={g.heading ?? undefined} role="rowgroup">
                {g.heading !== null && <tr className="group-row" role="row"><th scope="rowgroup" colSpan={2} role="rowheader">{g.heading}</th></tr>}
                {g.requirements.map((r) => (
                  <tr key={r.requirement.id} role="row">
                    <th scope="row" role="rowheader"><RecordLink index={index} id={r.requirement.id} /></th>
                    <td role="cell" data-label="Proved by"><Ids index={index} ids={r.tests.map((t) => t.test.id)} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </Section>
  );
}

const requirementOf = (page: View, id: string) => page.requirements.find((r) => r.requirement.id === id)!;
const testOf = (page: View, id: string) => page.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;

/** What one record of the view shows on its page, by the kind it is in the view. */
function Content({ index, page }: { index: RecordIndex; page: View }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'view': {
      const { view } = page;
      return (
        <>
          <Text index={index} id={id} source={view.description} field="description" />
          <Facts facts={view.route ? [{ label: 'Route', value: <code>{view.route}</code> }] : []} />
          <Text index={index} id={id} source={view.notes} title="Notes" field="notes" />
          <Requirements index={index} page={page} />
        </>
      );
    }
    case 'view_requirement':
      return <Text index={index} id={id} source={requirementOf(page, id).requirement.statement} field="statement" />;
    case 'view_test': {
      const { test, startsFrom } = testOf(page, id);
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: View): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (kind) {
    case 'view':
      return { lead: page.view.description, facts: [...(page.view.route ? [{ label: 'Route', value: <code>{page.view.route}</code> }] : []), { label: 'Holds', value: count(page.requirements.length, 'requirement', 'requirements') }] };
    case 'view_requirement': {
      const r = requirementOf(page, id);
      return { lead: r.requirement.statement, facts: [{ label: 'View', value: <RecordLink index={index} id={page.view.id} /> }, ...(r.requirement.group_name ? [{ label: 'Group', value: r.requirement.group_name }] : []), { label: 'Tests', value: r.tests.length }] };
    }
    case 'view_test': {
      const { test } = testOf(page, id);
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.view_requirement_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of a view: its page (or its summary in the wiki card), with its editor's actions. */
export function ViewPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useView(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <ViewEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="view">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </ViewEditor>
  );
}
