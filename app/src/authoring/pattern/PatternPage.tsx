import type { PatternPage as Pattern, PatternRuleOnPage } from '../../../../lathe/src/authoring/pattern/read-model';
import type { PatternRuleRow } from '../../../../lathe/src/platform/data/tables';
import type { AggregatePageProps } from '../../record/pages';
import { Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { FollowedBy, FollowedInCount, OwedBy } from '../../traceability/pattern-following/Followers';
import { PatternEditor } from './PatternEditor';
import { usePattern } from './reads';

// The Pattern page (LA-AUT-A2's page, LA-V122): any record of a pattern, at its address (/<id>), drawn from the pattern
// read whole (GET /api/pattern/get-pattern) and changed only through its own commands (PatternEditor). A pattern shows
// its description and notes, its settings (each with what it means and the rules that depend on it), its rules under
// their groups, and the domains that follow it with each one's settings and status per rule; a pattern rule its
// statement, its setting and condition, and the domains that owe it; a pattern rule test its domain and scenario. Who
// follows the pattern and the values they give are Pattern following's, its Followed by and Owed by
// (traceability/pattern-following/Followers.tsx), read through its own query, with the following's editor; each rule's
// standing is the coverage's, from the workspace's index. What every record's page holds around that is the Record
// page's (RecordFrame).

/** A pattern's followers have their own section, so its Traceability leaves them out. */
const PATTERN_SKIP: ReadonlySet<string> = new Set(['in:follows']);

/** The rules under their groups: the ungrouped ones first, then each group in the order it first appears. */
function groupsOf(rules: readonly PatternRuleOnPage[]): { heading: string | null; rules: PatternRuleOnPage[] }[] {
  const groups = new Map<string, { heading: string | null; rules: PatternRuleOnPage[] }>();
  for (const r of rules) {
    const heading = r.rule.group_name?.trim() || null;
    const key = heading?.toLowerCase() ?? '';
    const group = groups.get(key) ?? { heading, rules: [] };
    group.rules.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, g]) => g);
}

/** The settings table: each setting and what it means. */
function Settings({ page }: { page: Pattern }) {
  return (
    <Section title="Settings" count={page.settings.length}>
      {page.settings.length === 0 ? <p className="hint">This pattern has no settings.</p> : (
        <div className="table-scroll table-stack"><table className="data-table pattern-settings" role="table">
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Setting</th><th scope="col" role="columnheader">Meaning</th></tr></thead>
          <tbody role="rowgroup">
            {page.settings.map((s) => (
              <tr key={s.name} role="row">
                <th scope="row" role="rowheader"><code>{s.name}</code></th>
                <td role="cell" data-label="Meaning">{s.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Section>
  );
}

/** The rules under their group headings, each with its tags. */
function Rules({ index, page }: { index: RecordIndex; page: Pattern }) {
  return (
    <Section title="Rules" count={page.rules.length}>
      {page.rules.length === 0 ? <p className="hint">No rules yet.</p> : groupsOf(page.rules).map((g) => {
        const list = (
          <ul className="record-list plain pattern-rules">
            {g.rules.map((r) => <li key={r.rule.id}><RecordLink index={index} id={r.rule.id} row /></li>)}
          </ul>
        );
        return g.heading === null ? <div key="">{list}</div> : <Section key={g.heading} title={g.heading} count={g.rules.length} level={3} className="record-group">{list}</Section>;
      })}
    </Section>
  );
}

const ruleOf = (page: Pattern, id: string) => page.rules.find((r) => r.rule.id === id)!;
const testOf = (page: Pattern, id: string) => page.rules.flatMap((r) => r.tests).find((t) => t.test.id === id)!;

/** A rule's short facts: its group. */
function ruleFacts(rule: PatternRuleRow): Fact[] {
  return rule.group_name ? [{ label: 'Group', value: rule.group_name }] : [];
}

/** What one record of the pattern shows on its page, by the kind it is in the pattern. */
function Content({ index, page }: { index: RecordIndex; page: Pattern }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'pattern':
      return (
        <>
          <Text index={index} id={id} source={page.pattern.description} field="description" />
          <Text index={index} id={id} source={page.pattern.notes} title="Notes" field="notes" />
          <Settings page={page} />
          <Rules index={index} page={page} />
          <FollowedBy index={index} page={page} />
        </>
      );
    case 'pattern_rule': {
      const { rule } = ruleOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={rule.statement} field="statement" />
          <Text index={index} id={id} source={rule.notes} title="Notes" field="notes" />
          <OwedBy index={index} page={page} id={id} />
        </>
      );
    }
    case 'pattern_rule_test': {
      const { test, startsFrom } = testOf(page, id);
      return (
<TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />
      );
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Pattern): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (kind) {
    case 'pattern':
      return {
        lead: page.pattern.description,
        facts: [
          { label: 'Product', value: <RecordLink index={index} id={page.pattern.product_id} /> },
          { label: 'Holds', value: `${count(page.settings.length, 'setting', 'settings')}, ${count(page.rules.length, 'rule', 'rules')}` },
          { label: 'Followed in', value: <FollowedInCount index={index} pattern={page.pattern.id} /> },
        ],
      };
    case 'pattern_rule': {
      const { rule } = ruleOf(page, id);
      return { lead: rule.statement, facts: [{ label: 'Pattern', value: <RecordLink index={index} id={page.pattern.id} /> }, ...ruleFacts(rule)].slice(0, 3) };
    }
    case 'pattern_rule_test': {
      const { test } = testOf(page, id);
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.pattern_rule_id} /> }, { label: 'Domain', value: <RecordLink index={index} id={test.domain_id} /> }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of a pattern: its page (or its summary in the wiki card), with its editor's actions. */
export function PatternPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = usePattern(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <PatternEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="pattern">
          <RecordFrame index={index} record={index.byId.get(id)!} skip={page.record.kind === 'pattern' ? PATTERN_SKIP : undefined}>
            <Content index={index} page={page} />
          </RecordFrame>
          {after}
        </div>
      )}
    </PatternEditor>
  );
}
