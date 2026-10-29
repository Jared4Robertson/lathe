import type { StandardPage as Standard, StandardRuleOnPage } from '../../../../lathe/src/authoring/standard/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { relationLabelOf } from '../../specs/labels';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import type { SpecIndex } from '../../specs/data';
import { StandardEditor } from './StandardEditor';
import { useStandard } from './reads';

// The Standard page (LA-AUT-A3's page, LA-V123): any record of a standard, at its address (/<id>), drawn from the
// standard read whole (GET /api/standard/get-standard) and changed only through its own commands (StandardEditor). A
// standard shows its description and its rules in a table under their groups, one row each with what meets it and the
// tests that prove it; a standard rule its statement and group (its Traceability lists Met by and Proved by); a
// standard rule test its scenario and what it starts from. What every record's page holds around that (traceability,
// problems, facts and links) is the Record page's (RecordFrame).

/** A cell of record links, or a hint when there are none. */
function Ids({ index, ids }: { index: SpecIndex; ids: readonly string[] }) {
  return ids.length === 0 ? <span className="hint">Nothing yet</span> : (
    <span className="trace-cell">{ids.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}</span>
  );
}

/** The rules under their groups: the ungrouped ones first, then each group in the order it first appears. */
function groupsOf(rules: readonly StandardRuleOnPage[]): { heading: string | null; rules: StandardRuleOnPage[] }[] {
  const groups = new Map<string, { heading: string | null; rules: StandardRuleOnPage[] }>();
  for (const r of rules) {
    const heading = r.rule.group_name?.trim() || null;
    const key = heading?.toLowerCase() ?? '';
    const group = groups.get(key) ?? { heading, rules: [] };
    group.rules.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, g]) => g);
}

/** The standard's rules in a table, one row each with what meets it and its tests. */
function Rules({ index, page }: { index: SpecIndex; page: Standard }) {
  const metLabel = relationLabelOf(index.workspace.relations, 'meets', 'target');
  return (
    <Section title="Rules" count={page.rules.length}>
      {page.rules.length === 0 ? <p className="hint">No rules yet.</p> : (
        <div className="table-scroll">
          <table className="data-table standard-rules">
            <caption className="sr-only">The rules of {page.standard.id}, with what meets each one and its tests</caption>
            <thead><tr><th scope="col">Rule</th><th scope="col">{metLabel}</th><th scope="col">Proved by</th></tr></thead>
            {groupsOf(page.rules).map((g) => (
              <tbody key={g.heading ?? ''} data-group={g.heading ?? undefined}>
                {g.heading !== null && <tr className="group-row"><th scope="rowgroup" colSpan={3}>{g.heading}</th></tr>}
                {g.rules.map((r) => (
                  <tr key={r.rule.id}>
                    <th scope="row"><RecordLink index={index} id={r.rule.id} /></th>
                    <td><Ids index={index} ids={r.metBy} /></td>
                    <td><Ids index={index} ids={r.tests.map((t) => t.test.id)} /></td>
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

const ruleOf = (page: Standard, id: string) => page.rules.find((r) => r.rule.id === id)!;
const testOf = (page: Standard, id: string) => page.rules.flatMap((r) => r.tests).find((t) => t.test.id === id)!;

/** What one record of the standard shows on its page, by the kind it is in the standard. */
function Content({ index, page }: { index: SpecIndex; page: Standard }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'standard':
      return <><Text index={index} id={id} source={page.standard.description} field="description" /><Rules index={index} page={page} /></>;
    case 'standard_rule': {
      const { rule } = ruleOf(page, id);
      return <Text index={index} id={id} source={rule.statement} field="statement" />;
    }
    case 'standard_rule_test': {
      const { test, startsFrom } = testOf(page, id);
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: SpecIndex, page: Standard): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (kind) {
    case 'standard':
      return { lead: page.standard.description, facts: [{ label: 'Product', value: <RecordLink index={index} id={page.standard.product_id} /> }, { label: 'Holds', value: count(page.rules.length, 'rule', 'rules') }] };
    case 'standard_rule': {
      const r = ruleOf(page, id);
      return { lead: r.rule.statement, facts: [{ label: 'Standard', value: <RecordLink index={index} id={page.standard.id} /> }, { label: 'Met by', value: count(r.metBy.length, 'record', 'records') }, { label: 'Tests', value: r.tests.length }] };
    }
    case 'standard_rule_test': {
      const { test } = testOf(page, id);
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.standard_rule_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of a standard: its page (or its summary in the wiki card), with its editor's actions. */
export function StandardPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useStandard(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <StandardEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="standard">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </StandardEditor>
  );
}
