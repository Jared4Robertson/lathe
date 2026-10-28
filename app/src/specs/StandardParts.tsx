import { byIdOrder, type SpecIndex, type SpecRecord } from './data';
import { relationLabelOf } from './labels';
import { groupRecords } from './groups';
import { RecordLink, Section } from './parts';

// A standard's page (lathe/REFERENCE.md): its rules, one row each under their groups (section 22), with what meets each
// one and the standard rule tests that prove it. Its coverage is judged on the rule's own page; this page only lists them.

/** The records that meet a standard rule, in ID order. */
function metBy(index: SpecIndex, ruleId: string): string[] {
  return [...new Set((index.incoming.get(ruleId) ?? []).filter((l) => l.relation === 'meets').map((l) => l.source))]
    .map((id) => index.byId.get(id))
    .filter((r): r is SpecRecord => !!r)
    .sort(byIdOrder)
    .map((r) => r.id);
}

/** A standard rule's tests, in ID order. */
const testsOf = (index: SpecIndex, ruleId: string): string[] =>
  (index.children.get(ruleId) ?? []).filter((c) => c.kind === 'standard_rule_test').sort(byIdOrder).map((r) => r.id);

/** A cell of record links, or a hint when there are none. */
function Ids({ index, ids }: { index: SpecIndex; ids: string[] }) {
  return ids.length === 0 ? <span className="hint">Nothing yet</span> : (
    <span className="trace-cell">{ids.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}</span>
  );
}

export function StandardSections({ index, standard }: { index: SpecIndex; standard: SpecRecord }) {
  const rules = (index.children.get(standard.id) ?? []).filter((c) => c.kind === 'standard_rule').sort(byIdOrder);
  const metLabel = relationLabelOf(index.workspace.relations, 'meets', 'target');
  return (
    <Section title="Rules" count={rules.length}>
      {rules.length === 0 ? <p className="hint">No rules yet. Add <code>standard_rule</code> records under this standard.</p> : (
        <div className="table-scroll">
          <table className="data-table standard-rules">
            <caption className="sr-only">The rules of {standard.id}, with what meets each one and its tests</caption>
            <thead><tr><th scope="col">Rule</th><th scope="col">{metLabel}</th><th scope="col">Proved by</th></tr></thead>
            {groupRecords(rules).map((g) => (
              <tbody key={g.key} data-group={g.heading ?? undefined}>
                {g.heading !== null && <tr className="group-row"><th scope="rowgroup" colSpan={3}>{g.heading}</th></tr>}
                {g.records.map((r) => (
                  <tr key={r.id}>
                    <th scope="row"><RecordLink index={index} id={r.id} /></th>
                    <td><Ids index={index} ids={metBy(index, r.id)} /></td>
                    <td><Ids index={index} ids={testsOf(index, r.id)} /></td>
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
