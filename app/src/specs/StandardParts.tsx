import { byIdOrder, type SpecIndex, type SpecRecord } from './data';
import { relationLabelOf } from './labels';
import { RecordLink, Section } from './parts';

// A standard's page (FORMAT.md section 20): its rules, one row each, with what meets each one. A
// standard rule owes no coverage, so there is nothing to judge: the page only shows who follows it.

/** The records that meet a standard rule, in ID order. */
function metBy(index: SpecIndex, ruleId: string): string[] {
  return [...new Set((index.incoming.get(ruleId) ?? []).filter((l) => l.relation === 'meets').map((l) => l.source))]
    .map((id) => index.byId.get(id))
    .filter((r): r is SpecRecord => !!r)
    .sort(byIdOrder)
    .map((r) => r.id);
}

export function StandardSections({ index, standard }: { index: SpecIndex; standard: SpecRecord }) {
  const rules = (index.children.get(standard.id) ?? []).filter((c) => c.kind === 'standard_rule').sort(byIdOrder);
  const metLabel = relationLabelOf(index.workspace.relations, 'meets', 'target');
  return (
    <Section title="Rules" count={rules.length}>
      {rules.length === 0 ? <p className="hint">No rules yet. Add <code>standard_rule</code> records under this standard.</p> : (
        <div className="table-scroll">
          <table className="data-table standard-rules">
            <caption className="sr-only">The rules of {standard.id}, with what meets each one</caption>
            <thead><tr><th scope="col">Rule</th><th scope="col">{metLabel}</th></tr></thead>
            <tbody>
              {rules.map((r) => {
                const by = metBy(index, r.id);
                return (
                  <tr key={r.id}>
                    <th scope="row"><RecordLink index={index} id={r.id} /></th>
                    <td>
                      {by.length === 0 ? <span className="hint">Nothing yet</span> : (
                        <span className="trace-cell">{by.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
