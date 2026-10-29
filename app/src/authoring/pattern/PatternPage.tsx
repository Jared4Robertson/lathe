import { Fragment } from 'react';
import type { PatternPage as Pattern, PatternRuleOnPage } from '../../../../lathe/src/authoring/pattern/read-model';
import type { PatternRuleRow } from '../../../../lathe/src/platform/data/tables';
import type { AggregatePageProps } from '../../record/pages';
import { Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import type { SpecIndex } from '../../specs/data';
import { RecordLink, Section, SpecLink } from '../../specs/parts';
import { RuleMarks } from '../../specs/PatternParts';
import { appliesWhenText, followingDomains, notApplicableReason, ruleStatus, settingText, settingValue, type AppliesWhen } from '../../specs/patterns';
import { RecordFrame } from '../../specs/RecordContent';
import { addressOf } from '../../views/address';
import { PatternEditor } from './PatternEditor';
import { usePattern } from './reads';

// The Pattern page (LA-AUT-A2's page, LA-V122): any record of a pattern, at its address (/<id>), drawn from the pattern
// read whole (GET /api/pattern/get-pattern) and changed only through its own commands (PatternEditor). A pattern shows
// its description and notes, its settings (each with what it means and the rules that depend on it), its rules under
// their groups, and the domains that follow it with each one's settings and status per rule; a pattern rule its
// statement, its setting and condition, and the domains that owe it; a pattern rule test its domain and scenario. Who
// follows the pattern, the values they give and each rule's standing are Pattern following's and the coverage's, read
// from the workspace's index until those reads are their own. What every record's page holds around that is the
// Record page's (RecordFrame).

/** A pattern's followers have their own section, so its Traceability leaves them out. */
const PATTERN_SKIP: ReadonlySet<string> = new Set(['in:follows']);

/** A rule's applies-when condition, or null when it has none. */
const conditionOf = (rule: PatternRuleRow): AppliesWhen | null =>
  rule.applies_when_setting ? { setting: rule.applies_when_setting, not: rule.applies_when_negated === true, value: rule.applies_when_value ?? '' } : null;

/** What a rule's row says of its setting and its condition: "setting audit", "applies when scope is not single". */
function RuleTags({ rule }: { rule: PatternRuleRow }) {
  const condition = conditionOf(rule);
  return (
    <>
      {rule.setting && <small className="meta"> setting {rule.setting}</small>}
      {condition && <small className="meta"> applies when {appliesWhenText(condition)}</small>}
    </>
  );
}

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

/** The settings table: each setting, what it means, and the rules that depend on it. */
function Settings({ index, page }: { index: SpecIndex; page: Pattern }) {
  return (
    <Section title="Settings" count={page.settings.length}>
      {page.settings.length === 0 ? <p className="hint">This pattern has no settings.</p> : (
        <div className="table-scroll table-stack"><table className="data-table pattern-settings" role="table">
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Setting</th><th scope="col" role="columnheader">Meaning</th><th scope="col" role="columnheader">Rules that depend on it</th></tr></thead>
          <tbody role="rowgroup">
            {page.settings.map((s) => {
              const dependent = page.rules.filter((r) => r.rule.setting?.trim() === s.name || r.rule.applies_when_setting === s.name);
              return (
                <tr key={s.name} role="row">
                  <th scope="row" role="rowheader"><code>{s.name}</code></th>
                  <td role="cell" data-label="Meaning">{s.meaning}</td>
                  <td role="cell" data-label="Rules that depend on it">{dependent.length === 0 ? <span className="hint">None</span> : dependent.map((r, i) => <Fragment key={r.rule.id}>{i > 0 && ', '}<RecordLink index={index} id={r.rule.id} showTitle={false} /></Fragment>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </Section>
  );
}

/** The rules under their group headings, each with its tags. */
function Rules({ index, page }: { index: SpecIndex; page: Pattern }) {
  return (
    <Section title="Rules" count={page.rules.length}>
      {page.rules.length === 0 ? <p className="hint">No rules yet.</p> : groupsOf(page.rules).map((g) => {
        const list = (
          <ul className="record-list plain pattern-rules">
            {g.rules.map((r) => <li key={r.rule.id}><RecordLink index={index} id={r.rule.id} row /><RuleTags rule={r.rule} /></li>)}
          </ul>
        );
        return g.heading === null ? <div key="">{list}</div> : <Section key={g.heading} title={g.heading} count={g.rules.length} level={3} className="record-group">{list}</Section>;
      })}
    </Section>
  );
}

/** Each domain that follows the pattern: who follows it there, the values they give, and the domain's status per rule. */
function FollowedBy({ index, page }: { index: SpecIndex; page: Pattern }) {
  const patternId = page.pattern.id;
  const domains = followingDomains(index, patternId);
  return (
    <Section title="Followed by" count={domains.length}>
      {domains.length === 0 && <p className="hint">No use case follows this pattern, so no domain owes its rules.</p>}
      {domains.map((followed) => {
        const { domain, useCases } = followed;
        const d = index.byId.get(domain);
        // A domain that follows the pattern itself gives its settings on its own record, in the first row.
        const givers = [...(followed.byDomain && d ? [d] : []), ...useCases];
        return (
          <section key={domain} className="pattern-domain" aria-label={`Followed in ${domain}`}>
            <h3>
              {d?.product ? <SpecLink to={addressOf(domain)} className="record-link"><code>{domain}</code> <span>{d.title}</span></SpecLink> : <SpecLink to={addressOf(domain)}><code>{domain}</code></SpecLink>}
            </h3>
            <div className="table-scroll table-stack">
              <table className="data-table pattern-use-cases" role="table">
                <caption className="sr-only">Use cases in {domain} that follow {patternId}, with their settings</caption>
                <thead role="rowgroup">
                  <tr role="row"><th scope="col" role="columnheader">Use case</th>{page.settings.map((s) => <th key={s.name} scope="col" role="columnheader"><code>{s.name}</code></th>)}</tr>
                </thead>
                <tbody role="rowgroup">
                  {givers.map((uc) => (
                    <tr key={uc.id} role="row">
                      <th scope="row" role="rowheader">{uc.kind === 'domain' ? <>The whole domain</> : <RecordLink index={index} id={uc.id} />}</th>
                      {page.settings.map((s) => {
                        const given = settingValue(index, uc.id, patternId, s.name);
                        return <td key={s.name} role="cell" data-label={s.name} className={notApplicableReason(given) !== null ? 'setting-na' : undefined}>{given ? settingText(given) : <span className="hint">not given</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.rules.length > 0 && (
              <table className="data-table pattern-rule-status">
                <caption className="sr-only">How {domain} proves each rule of {patternId}</caption>
                <thead><tr><th scope="col">Rule</th><th scope="col">In {domain}</th></tr></thead>
                <tbody>
                  {page.rules.map((r) => (
                    <tr key={r.rule.id}>
                      <th scope="row"><RecordLink index={index} id={r.rule.id} /></th>
                      <td>{index.byId.has(r.rule.id) && <RuleMarks index={index} status={ruleStatus(index, index.byId.get(r.rule.id)!, domain, followed)} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </Section>
  );
}

/** The domains that owe a rule, each with its standing for it. */
function OwedBy({ index, page, id }: { index: SpecIndex; page: Pattern; id: string }) {
  const domains = followingDomains(index, page.pattern.id);
  const rule = index.byId.get(id);
  return (
    <Section title="Owed by" count={domains.length}>
      {domains.length === 0 || !rule ? <p className="hint">No domain follows this rule's pattern.</p> : (
        <table className="data-table pattern-rule-status">
          <thead><tr><th scope="col">Domain</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {domains.map((followed) => (
              <tr key={followed.domain}>
                <th scope="row"><RecordLink index={index} id={followed.domain} /></th>
                <td><RuleMarks index={index} status={ruleStatus(index, rule, followed.domain, followed)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

const ruleOf = (page: Pattern, id: string) => page.rules.find((r) => r.rule.id === id)!;
const testOf = (page: Pattern, id: string) => page.rules.flatMap((r) => r.tests).find((t) => t.test.id === id)!;

/** A rule's short facts: its group, its setting and its condition. */
function ruleFacts(rule: PatternRuleRow): Fact[] {
  const condition = conditionOf(rule);
  return [
    ...(rule.group_name ? [{ label: 'Group', value: rule.group_name }] : []),
    ...(rule.setting ? [{ label: 'Setting', value: <code>{rule.setting}</code> }] : []),
    ...(condition ? [{ label: 'Applies when', value: appliesWhenText(condition) }] : []),
  ];
}

/** What one record of the pattern shows on its page, by the kind it is in the pattern. */
function Content({ index, page }: { index: SpecIndex; page: Pattern }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'pattern':
      return (
        <>
          <Text index={index} id={id} source={page.pattern.description} field="description" />
          <Text index={index} id={id} source={page.pattern.notes} title="Notes" field="notes" />
          <Settings index={index} page={page} />
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
function summaryOf(index: SpecIndex, page: Pattern): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (kind) {
    case 'pattern':
      return {
        lead: page.pattern.description,
        facts: [
          { label: 'Product', value: <RecordLink index={index} id={page.pattern.product_id} /> },
          { label: 'Holds', value: `${count(page.settings.length, 'setting', 'settings')}, ${count(page.rules.length, 'rule', 'rules')}` },
          { label: 'Followed in', value: count(followingDomains(index, page.pattern.id).length, 'domain', 'domains') },
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
